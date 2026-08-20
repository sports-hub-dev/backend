const axios = require("axios");
const crypto = require("crypto");
const Order = require("../../models/Order");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

const paymobService = {
    async initiatePayment(orderId) {
        const order = await Order.findById(orderId);
        if (!order) throw new AppError("Order not found", 404);
        if (order.paymentStatus === "paid") throw new AppError("Order is already paid", 400);

        const [firstName, ...rest] = order.customerInfo.name.split(" ");

        const { data } = await axios.post(
            "https://accept.paymob.com/v1/intention/",
            {
                amount: Math.round(order.total * 100),
                currency: "EGP",
                payment_methods: [
                Number(process.env.PAYMOB_INTEGRATION_ID),
                Number(process.env.PAYMOB_WALLET_INTEGRATION_ID),
                ],
                billing_data: {
                    first_name: firstName || "NA",
                    last_name: rest.join(" ") || "NA",
                    email: order.customerInfo.email,
                    phone_number: order.customerInfo.phone,
                },
                special_reference: order.orderNumber,
                notification_url: `${process.env.BASE_URL}/api/v1/payments/paymob/callback`,
                redirection_url: `${process.env.BASE_URL}/api/v1/payments/paymob/callback`,
            },
            { headers: { Authorization: `Token ${process.env.PAYMOB_API_KEY}` } }
        );

        order.paymentMethod = "paymob";
        order.paymobOrderId = data.id;
        await order.save();

        return {
            checkoutUrl: `https://accept.paymob.com/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${data.client_secret}`,
        };
    },

    _verifyHmac(obj, receivedHmac) {
        const fields = [
            "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id",
            "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
            "is_voided", "order", "owner", "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success",
        ];
        const concatenated = fields.map((f) => {
            if (obj[f] !== undefined) return String(obj[f]);
            let val = obj;
            f.split(".").forEach((p) => { val = val?.[p]; });
            return val === undefined || val === null ? "" : String(val);
        }).join("");
        const computed = crypto.createHmac("sha512", process.env.PAYMOB_HMAC_SECRET).update(concatenated).digest("hex");
        return computed === receivedHmac;
    },

    async handleCallback(body, hmacFromQuery) {
        const txn = body.obj || body;
        if (!this._verifyHmac(txn, hmacFromQuery)) throw new AppError("Invalid Paymob HMAC signature", 401);

        const order = await Order.findOne({ orderNumber: txn.merchant_order_id });
        if (!order) return { success: false, redirectUrl: `${process.env.CLIENT_URL}/checkout?payment=failed` };

        order.paymobTransactionId = txn.id;
        order.paymentReference = txn.id;

        if (txn.success === true || txn.success === "true") {
            order.paymentStatus = "paid";
            order.paidAt = new Date();
            if (order.status === "pending") {
                order.status = "confirmed";
                order.timeline.push({ previousStatus: "pending", newStatus: "confirmed", changedByName: "Paymob", notes: "Payment confirmed" });
            }
        } else {
            order.paymentStatus = "failed";
        }
        await order.save();

        return {
            success: order.paymentStatus === "paid",
            redirectUrl: order.paymentStatus === "paid"
                ? `${process.env.CLIENT_URL}/orders/${order._id}?payment=success`
                : `${process.env.CLIENT_URL}/checkout?payment=failed`,
        };
    },
};

module.exports = paymobService;