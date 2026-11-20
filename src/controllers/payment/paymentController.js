const mongoose = require("mongoose");
const Order = require("../../models/Order");
const orderService = require("../../services/orderService");
const stripeService = require("../../services/payment/stripeService");
const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/AppError");
const { successResponse } = require("../../utils/apiResponse");
const logger = require("../../utils/logger");
const paymobService = require("../../services/payment/paymobService");
const { resolveOrderCurrency } = require("../../utils/currency");

// Shared by every gateway: prices the cart in the delivery country's currency,
// creates the order (deducts stock) inside a transaction, then the caller hands
// off to whichever gateway service initiates the actual payment.
const createOrderFromCart = async (req) => {
    const { items, customerInfo, shippingAddress, promoCode, currency: requestedCurrency } = req.body;
    const { currency, country } = resolveOrderCurrency(shippingAddress, requestedCurrency);
    const userVendorId = req.user?.vendorId?.toString() || null;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const enrichedItems = await orderService.enrichItems({ items, currency, userVendorId, session });
        const order = await orderService.createOrder(
            {
                items: enrichedItems, customerInfo, shippingAddress, promoCode, currency, country,
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

const orderSummary = (order) => ({
    _id: order._id, orderNumber: order.orderNumber, total: order.total, currency: order.currency,
});

// ── Paymob (Egyptian cards and wallets — EGP only) ──────────────────────────
exports.createPaymobOrder = asyncHandler(async (req, res) => {
    const { currency } = resolveOrderCurrency(req.body.shippingAddress, req.body.currency);
    if (currency !== "EGP") {
        throw new AppError("Paymob only accepts EGP. Please pay by card for deliveries outside Egypt.", 400);
    }
    const order = await createOrderFromCart(req);
    logger.info(`Order created for Paymob: ${order._id}, orderNumber: ${order.orderNumber}`);
    const paymobData = await paymobService.initiatePayment(order._id);

    successResponse(res, 201, "Order created", { order: orderSummary(order), paymob: paymobData });
});

exports.paymobCallback = asyncHandler(async (req, res) => {
    const payload = Object.keys(req.body || {}).length ? req.body : req.query;
    const result = await paymobService.handleCallback(payload, req.query.hmac);
    res.redirect(result.redirectUrl);
});

// // ── APS ──────────────────────────────────────────────────────────────────
// exports.createApsOrder = asyncHandler(async (req, res) => {
//     const order = await createOrderFromCart(req);
//     const apsData = await apsService.initiatePayment(order._id);

//     successResponse(res, 201, "Order created. Redirect the browser to APS's hosted checkout page.", {
//         order: { _id: order._id, orderNumber: order.orderNumber, total: order.total },
//         aps: apsData,
//     });
// });

// exports.apsReturn = asyncHandler(async (req, res) => {
//     const payload = Object.keys(req.body || {}).length ? req.body : req.query;
//     const result = await apsService.handleReturn(payload);
//     res.redirect(result.redirectUrl);
// });

// ── Stripe ───────────────────────────────────────────────────────────────
exports.createStripeOrder = asyncHandler(async (req, res) => {
    const order = await createOrderFromCart(req);
    const stripeData = await stripeService.createCheckoutSession(order._id);

    successResponse(res, 201, "Order created", { order: orderSummary(order), stripe: stripeData });
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
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        orderStatus: order.status,
        total: order.total,
        paidAt: order.paidAt,
    });
});