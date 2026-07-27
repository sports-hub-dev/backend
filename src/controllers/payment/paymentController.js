const mongoose       = require("mongoose");
const Order          = require("../../models/Order");
const orderService    = require("../../services/orderService");
const apsService      = require("../../services/payment/apsService");
const stripeService   = require("../../services/payment/stripeService");
const asyncHandler    = require("../../utils/asyncHandler");
const AppError        = require("../../utils/AppError");
const { successResponse } = require("../../utils/apiResponse");
const logger          = require("../../utils/logger");

// Shared by both gateways — creates the order (deducts stock) inside a transaction,
// then hands off to whichever gateway service initiates the actual payment.
const createOrderFromCart = async (req) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, customerInfo, shippingAddress, promoCode } = req.body;
    const userVendorId = req.user?.vendorId?.toString() || null;
    const Product = require("../../models/Product");

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
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
        return {
          product:   product._id,
          name:      product.name,
          mainImage: product.mainImage,
          size:      item.size || null,
          quantity:  item.quantity,
          price:     product.price,
        };
      })
    );

    const order = await orderService.createOrder(
      {
        items: enrichedItems, customerInfo, shippingAddress, promoCode,
        userId: req.user._id, vendorId: userVendorId ? req.user.vendorId : null,
      },
      session
    );

    await session.commitTransaction();
    session.endSession();
    return order;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

// ── APS ──────────────────────────────────────────────────────────────────
exports.createApsOrder = asyncHandler(async (req, res) => {
  const order = await createOrderFromCart(req);
  const apsData = await apsService.initiatePayment(order._id);

  successResponse(res, 201, "Order created. Redirect the browser to APS's hosted checkout page.", {
    order: { _id: order._id, orderNumber: order.orderNumber, total: order.total },
    aps: apsData,
  });
});

exports.apsReturn = asyncHandler(async (req, res) => {
  const payload = Object.keys(req.body || {}).length ? req.body : req.query;
  const result = await apsService.handleReturn(payload);
  res.redirect(result.redirectUrl);
});

// ── Stripe ───────────────────────────────────────────────────────────────
exports.createStripeOrder = asyncHandler(async (req, res) => {
  const order = await createOrderFromCart(req);
  const stripeData = await stripeService.createPaymentIntent(order._id);

  successResponse(res, 201, "Order created", {
    order: { _id: order._id, orderNumber: order.orderNumber, total: order.total },
    stripe: stripeData,
  });
});

exports.stripeWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["stripe-signature"];
  try {
    await stripeService.handleWebhook(req.body, signature);
    res.json({ received: true });
  } catch (err) {
    logger.error(`Stripe webhook error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

exports.stripeRefund = asyncHandler(async (req, res) => {
  const refund = await stripeService.refund(req.params.orderId);
  successResponse(res, 200, "Refund processed", { refund });
});

// ── Shared ───────────────────────────────────────────────────────────────
exports.getPaymentStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)
    .select("orderNumber paymentStatus paymentMethod status total paidAt user");
  if (!order) throw new AppError("Order not found", 404);

  if (req.user.role !== "admin" && order.user?.toString() !== req.user._id.toString()) {
    throw new AppError("Not authorized", 403);
  }

  successResponse(res, 200, "Payment status fetched", {
    orderNumber:   order.orderNumber,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    orderStatus:   order.status,
    total:         order.total,
    paidAt:        order.paidAt,
  });
});