const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../../models/Order");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

const stripeService = {
  async createPaymentIntent(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);
    if (order.paymentStatus === "paid") throw new AppError("Order is already paid", 400);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100),
      currency: "egp",
      metadata: { orderNumber: order.orderNumber, orderId: order._id.toString() },
      receipt_email: order.customerInfo.email,
    });

    order.paymentMethod = "stripe";
    order.stripePaymentIntentId = paymentIntent.id;
    order.stripeClientSecret = paymentIntent.client_secret;
    await order.save();

    return { clientSecret: paymentIntent.client_secret };
  },

  async handleWebhook(rawBody, signature) {
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const order = await Order.findOne({ stripePaymentIntentId: intent.id });
      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
        order.paidAt = new Date();
        order.paymentReference = intent.id;
        if (order.status === "pending") {
          order.status = "confirmed";
          order.timeline.push({
            previousStatus: "pending",
            newStatus: "confirmed",
            changedByName: "Stripe",
            notes: `Payment confirmed`,
          });
        }
        await order.save();
        logger.info(`Order ${order.orderNumber} marked PAID via Stripe`);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const order = await Order.findOne({ stripePaymentIntentId: intent.id });
      if (order) {
        order.paymentStatus = "failed";
        await order.save();
      }
    }
    return { received: true };
  },

  async refund(orderId) {
    const order = await Order.findById(orderId);
    if (!order?.stripePaymentIntentId) throw new AppError("No Stripe payment found for this order", 400);
    const refund = await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
    order.paymentStatus = "refunded";
    await order.save();
    return refund;
  },
};

module.exports = stripeService;