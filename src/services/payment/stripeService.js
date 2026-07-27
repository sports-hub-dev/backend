const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../../models/Order");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

const stripeService = {
  async createCheckoutSession(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);
    if (order.paymentStatus === "paid") throw new AppError("Order is already paid", 400);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: order.customerInfo.email,
      line_items: [
        {
          price_data: {
            currency: "egp",
            product_data: { name: `Sports Hub Order ${order.orderNumber}` },
            unit_amount: Math.round(order.total * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
      success_url: `${process.env.CLIENT_URL}/orders/${order._id}?payment=success`,
      cancel_url: `${process.env.CLIENT_URL}/checkout?payment=failed`,
    });

    order.paymentMethod = "stripe";
    await order.save();

    return { checkoutUrl: session.url };
  },

  async handleWebhook(rawBody, signature) {
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const order = await Order.findById(session.metadata.orderId);
      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
        order.paidAt = new Date();
        order.paymentReference = session.payment_intent;
        if (order.status === "pending") {
          order.status = "confirmed";
          order.timeline.push({
            previousStatus: "pending",
            newStatus: "confirmed",
            changedByName: "Stripe",
            notes: `Payment confirmed — Checkout Session: ${session.id}`,
          });
        }
        await order.save();
        logger.info(`Order ${order.orderNumber} marked PAID via Stripe Checkout`);
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const order = await Order.findById(session.metadata.orderId);
      if (order) {
        order.paymentStatus = "failed";
        await order.save();
      }
    }

    return { received: true };
  },

  async refund(orderId) {
    const order = await Order.findById(orderId);
    if (!order?.paymentReference) throw new AppError("No Stripe payment found for this order", 400);
    const refund = await stripe.refunds.create({ payment_intent: order.paymentReference });
    order.paymentStatus = "refunded";
    await order.save();
    return refund;
  },
};

module.exports = stripeService;