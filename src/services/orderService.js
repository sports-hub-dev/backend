const mongoose = require("mongoose");
const Order = require("../models/Order");
const Bundle = require("../models/Bundle");
const PromoCode = require("../models/PromoCode");
const Settings = require("../models/Settings");
const inventoryService = require("./inventoryService");
const AppError = require("../utils/AppError");
const { ORDER_STATUS } = require("../utils/constants");
const Product = require("../models/Product");
const { productPrice, shippingFeeKey, COUNTRY_NAMES } = require("../utils/currency");

/**
 * Expands any bundle line items into their underlying component products,
 * scaled by how many bundles were ordered — so stock deduction/restoration
 * can reuse inventoryService's existing per-product logic completely
 * unchanged. Regular (non-bundle) items pass through as-is.
 */
// const expandItemsForStock = async (items, session) => {
//   const expanded = [];
//   for (const item of items) {
//     if (item.bundle) {
//       const bundle = await Bundle.findById(item.bundle).session(session);
//       if (!bundle) throw new AppError("Bundle not found", 404);
//       for (const component of bundle.products) {
//         expanded.push({
//           product: component.product,
//           quantity: component.quantity * item.quantity,
//         });
//       }
//     } else {
//       expanded.push(item);
//     }
//   }
//   return expanded;
// };

const expandItemsForStock = async (items, session) => {
  const expanded = [];
  for (const item of items) {
    if (item.bundle) {
      const bundle = await Bundle.findById(item.bundle).session(session);
      if (!bundle) throw new AppError("Bundle not found", 404);
      for (const component of bundle.products) {
        const selection = (item.bundleSelections || []).find(
          (s) => s.product.toString() === component.product.toString()
        );
        expanded.push({
          product: component.product,
          quantity: component.quantity * item.quantity,
          size: selection?.size || null,
        });
      }
    } else {
      expanded.push(item);
    }
  }
  return expanded;
};

const orderService = {

  /**
   * Turns the cart sent by the browser into priced order lines, using prices
   * from the database in the order's currency (never prices sent by the client).
   * Also enforces bundle size selections and vendor-only product access.
   * Shared by normal checkout, Stripe and Paymob so they can't drift apart.
   */
  async enrichItems({ items, currency = "EGP", userVendorId = null, session }) {
    const enriched = [];
    for (const item of items) {
      if (item.bundle) {
        const bundle = await Bundle.findById(item.bundle).session(session).populate("products.product");
        if (!bundle || bundle.isDeleted || !bundle.isActive) {
          throw new AppError("Bundle is not available", 400);
        }
        for (const component of bundle.products) {
          if (component.product.hasSizeVariants) {
            const sel = (item.selections || []).find((s) => s.product === component.product._id.toString());
            if (!sel?.size) {
              throw new AppError(`Please select a size for ${component.product.name} in bundle "${bundle.name}"`, 400);
            }
          }
        }
        const { bundlePrice } = await bundle.calculatePrice(currency);
        if (bundlePrice === null) {
          throw new AppError(`"${bundle.name}" isn't available in ${currency} yet`, 400);
        }
        enriched.push({
          bundle: bundle._id, name: bundle.name, mainImage: bundle.mainImage,
          quantity: item.quantity, price: bundlePrice, bundleSelections: item.selections || [],
        });
        continue;
      }

      const product = await Product.findById(item.product).session(session);
      if (!product || product.isDeleted || !product.isActive) {
        throw new AppError(`Product ${item.product} is not available`, 400);
      }
      if (!product.isPublic) {
        if (!userVendorId) throw new AppError(`Product "${product.name}" is not available`, 403);
        if (product.vendorId?.toString() !== userVendorId) {
          throw new AppError(`Product "${product.name}" is not available`, 403);
        }
      }
      const price = productPrice(product, currency);
      if (price === null) {
        throw new AppError(`"${product.name}" isn't available in ${currency} yet`, 400);
      }
      enriched.push({
        product: product._id, name: product.name, mainImage: product.mainImage,
        size: item.size || null, quantity: item.quantity, price,
      });
    }
    return enriched;
  },

  /** Flat shipping fee for a currency. EGP keeps the old 75 default; SAR/AED must be set by the admin. */
  async getShippingFee(currency = "EGP") {
    if (currency === "EGP") return Settings.getValue("shippingFee", 75);
    const fee = await Settings.getValue(shippingFeeKey(currency), null);
    if (fee === null || fee === undefined || fee === "") return null;
    return Number(fee);
  },

  async createOrder(orderData, session) {
    const {
      items, customerInfo, shippingAddress, promoCode: promoCodeStr, userId, vendorId,
      currency = "EGP", country = "EG",
    } = orderData;

    const shippingFee = await this.getShippingFee(currency);
    if (shippingFee === null) {
      throw new AppError(`Delivery to ${COUNTRY_NAMES[country] || country} isn't set up yet. Please contact us.`, 400);
    }

    let discount = 0;
    let promoDiscount = 0;
    let appliedCode = null;

    if (promoCodeStr) {
      const promo = await PromoCode.findOne({ code: promoCodeStr.toUpperCase() });
      if (!promo) throw new AppError("Invalid promo code", 400);
      if (!promo.isValid) throw new AppError("Promo code is expired or inactive", 400);

      promoDiscount = promo.discountPercentage;
      appliedCode = promo.code;
      await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usageCount: 1 } }, { session });
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    discount = promoDiscount ? Math.round((subtotal * promoDiscount) / 100) : 0;
    const total = Math.max(0, subtotal - discount + shippingFee);

    const [order] = await Order.create(
      [
        {
          user: userId || null,
          isGuest: false,
          customerInfo,
          shippingAddress: { ...shippingAddress, country: COUNTRY_NAMES[country] || shippingAddress?.country },
          items: items.map((i) => ({
            product: i.product || null,
            bundle: i.bundle || null,
            bundleSelections: i.bundleSelections || undefined,
            name: i.name,
            mainImage: i.mainImage,
            size: i.size || null,
            quantity: i.quantity,
            price: i.price,
          })),
          subtotal,
          shippingFee,
          discount,
          promoCode: appliedCode,
          promoDiscount,
          total,
          currency,
          country,
          vendorId: vendorId || null,
          status: ORDER_STATUS.PENDING,
          timeline: [{ newStatus: ORDER_STATUS.PENDING, notes: "Order placed" }],
        },
      ],
      { session }
    );

    const stockItems = await expandItemsForStock(items, session);
    await inventoryService.deductStockForOrder(stockItems, session, order._id);
    return order;
  },

  async updateOrderStatus(orderId, newStatus, adminId, adminName, notes, session) {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError("Order not found", 404);

    const previousStatus = order.status;

    if (newStatus === ORDER_STATUS.CANCELLED && previousStatus !== ORDER_STATUS.CANCELLED) {
      const stockItems = await expandItemsForStock(order.items, session);
      await inventoryService.restoreStockForOrder(stockItems, session, order._id);
    }

    order.status = newStatus;
    order.timeline.push({
      previousStatus,
      newStatus,
      changedBy: adminId,
      changedByName: adminName,
      notes,
    });

    await order.save({ session });
    return order;
  },
};

module.exports = orderService;