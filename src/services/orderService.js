const mongoose    = require("mongoose");
const Order       = require("../models/Order");
const PromoCode   = require("../models/PromoCode");
const Settings    = require("../models/Settings");
const inventoryService = require("./inventoryService");
const AppError    = require("../utils/AppError");
const { ORDER_STATUS } = require("../utils/constants");

const orderService = {

  async createOrder(orderData, session) {
    const { items, customerInfo, shippingAddress, promoCode: promoCodeStr, userId, vendorId } = orderData;

    // 1. Shipping fee from settings
    const shippingFee = await Settings.getValue("shippingFee", 75);

    // 2. Validate + apply promo code
    let discount      = 0;
    let promoDiscount = 0;
    let appliedCode   = null;

    if (promoCodeStr) {
      const promo = await PromoCode.findOne({ code: promoCodeStr.toUpperCase() });
      if (!promo)       throw new AppError("Invalid promo code", 400);
      if (!promo.isValid) throw new AppError("Promo code is expired or inactive", 400);

      promoDiscount = promo.discountPercentage;
      appliedCode   = promo.code;
      await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usageCount: 1 } }, { session });
    }

    // 3. Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    discount       = promoDiscount ? Math.round((subtotal * promoDiscount) / 100) : 0;
    const total    = Math.max(0, subtotal - discount + shippingFee);

    // 4. Create order + deduct stock (both inside the same session)
    const [order] = await Order.create(
      [
        {
          user:            userId || null,
          isGuest:         false,
          customerInfo,
          shippingAddress,
          items:           items.map((i) => ({
            product:   i.product,
            name:      i.name,
            mainImage: i.mainImage,
            size:      i.size || null,
            quantity:  i.quantity,
            price:     i.price,
          })),
          subtotal,
          shippingFee,
          discount,
          promoCode:     appliedCode,
          promoDiscount,
          total,
          vendorId:      vendorId || null,
          status:        ORDER_STATUS.PENDING,
          timeline:      [{ newStatus: ORDER_STATUS.PENDING, notes: "Order placed" }],
        },
      ],
      { session }
    );

    await inventoryService.deductStockForOrder(items, session, order._id);
    return order;
  },

  async updateOrderStatus(orderId, newStatus, adminId, adminName, notes, session) {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError("Order not found", 404);

    const previousStatus = order.status;

    // Restore stock on cancellation
    if (newStatus === ORDER_STATUS.CANCELLED && previousStatus !== ORDER_STATUS.CANCELLED) {
      await inventoryService.restoreStockForOrder(order.items, session, order._id);
    }

    order.status = newStatus;
    order.timeline.push({
      previousStatus,
      newStatus,
      changedBy:     adminId,
      changedByName: adminName,
      notes,
    });

    await order.save({ session });
    return order;
  },
};

module.exports = orderService;
