const mongoose = require("mongoose");
const Order = require("../models/Order");
const Bundle = require("../models/Bundle");
const PromoCode = require("../models/PromoCode");
const Settings = require("../models/Settings");
const inventoryService = require("./inventoryService");
const AppError = require("../utils/AppError");
const { ORDER_STATUS } = require("../utils/constants");

/**
 * Expands any bundle line items into their underlying component products,
 * scaled by how many bundles were ordered — so stock deduction/restoration
 * can reuse inventoryService's existing per-product logic completely
 * unchanged. Regular (non-bundle) items pass through as-is.
 */
const expandItemsForStock = async (items, session) => {
  const expanded = [];
  for (const item of items) {
    if (item.bundle) {
      const bundle = await Bundle.findById(item.bundle).session(session);
      if (!bundle) throw new AppError("Bundle not found", 404);
      for (const component of bundle.products) {
        expanded.push({
          product: component.product,
          quantity: component.quantity * item.quantity,
        });
      }
    } else {
      expanded.push(item);
    }
  }
  return expanded;
};

const orderService = {

  async createOrder(orderData, session) {
    const { items, customerInfo, shippingAddress, promoCode: promoCodeStr, userId, vendorId } = orderData;

    const shippingFee = await Settings.getValue("shippingFee", 75);

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
          shippingAddress,
          items: items.map((i) => ({
            product: i.product || null,
            bundle: i.bundle || null,
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