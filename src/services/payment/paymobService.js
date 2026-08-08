const axios = require("axios");
const crypto = require("crypto");
const Order = require("../../models/Order");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

const BASE_URL = "https://accept.paymob.com/api";

const paymobService = {
  async _authenticate() {
    const { data } = await axios.post(`${BASE_URL}/auth/tokens`, { api_key: process.env.PAYMOB_API_KEY });
    return data.token;
  },

  async _createPaymobOrder(authToken, order) {
    const { data } = await axios.post(`${BASE_URL}/ecommerce/orders`, {
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: Math.round(order.total * 100),
      currency: "EGP",
      merchant_order_id: order.orderNumber,
      items: [],
    });
    return data.id;
  },

  async _getPaymentKey(authToken, paymobOrderId, order) {
    const [firstName, ...rest] = order.customerInfo.name.split(" ");
    const { data } = await axios.post(`${BASE_URL}/acceptance/payment_keys`, {
      auth_token: authToken,
      amount_cents: Math.round(order.total * 100),
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: {
        first_name: firstName || "N/A",
        last_name: rest.join(" ") || "N/A",
        email: order.customerInfo.email,
        phone_number: order.customerInfo.phone,
        apartment: "NA", floor: "NA", street: "NA", building: "NA",
        city: order.shippingAddress.city, country: "EG",
        state: "NA", postal_code: "NA",
      },
      currency: "EGP",
      integration_id: process.env.PAYMOB_INTEGRATION_ID,
    });
    return data.token;
  },

  async initiatePayment(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);
    if (order.paymentStatus === "paid") throw new AppError("Order is already paid", 400);

    const authToken = await this._authenticate();
    const paymobOrderId = await this._createPaymobOrder(authToken, order);
    const paymentToken = await this._getPaymentKey(authToken, paymobOrderId, order);

    order.paymentMethod = "paymob";
    order.paymobOrderId = paymobOrderId;
    await order.save();

    return { iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}` };
  },

  // Paymob's HMAC covers a fixed, ordered set of fields — concatenated (no separator) then HMAC-SHA512'd
  _verifyHmac(obj, receivedHmac) {
    const fields = [
      "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id",
      "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
      "is_voided", "order", "owner", "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success",
    ];
    const concatenated = fields.map((f) => {
      const parts = f.split(".");
      let val = obj;
      parts.forEach((p) => { val = val?.[p]; });
      return val === undefined || val === null ? "" : String(val);
    }).join("");

    const computed = crypto.createHmac("sha512", process.env.PAYMOB_HMAC_SECRET).update(concatenated).digest("hex");
    return computed === receivedHmac;
  },

  async handleCallback(body, hmacFromQuery) {
    const txn = body.obj || body;
    const isValid = this._verifyHmac(txn, hmacFromQuery);
    if (!isValid) throw new AppError("Invalid Paymob HMAC signature", 401);

    const order = await Order.findOne({ paymobOrderId: txn.order?.id || txn.order });
    if (!order) {
      logger.warn(`Paymob callback: no order found for paymob order ${txn.order}`);
      return { success: false, redirectUrl: `${process.env.CLIENT_URL}/checkout?payment=failed` };
    }

    order.paymobTransactionId = txn.id;
    order.paymentReference = txn.id;

    if (txn.success === true || txn.success === "true") {
      order.paymentStatus = "paid";
      order.paidAt = new Date();
      if (order.status === "pending") {
        order.status = "confirmed";
        order.timeline.push({ previousStatus: "pending", newStatus: "confirmed", changedByName: "Paymob", notes: `Payment confirmed — txn: ${txn.id}` });
      }
      logger.info(`Order ${order.orderNumber} marked PAID via Paymob`);
    } else {
      order.paymentStatus = "failed";
    }

    await order.save();

    return {
      success: order.paymentStatus === "paid",
      redirectUrl: order.paymentStatus === "paid"
        ? `${process.env.CLIENT_URL}/orders/${order._id}?payment=success`
        : `${process.env.CLIENT_URL}/checkout?payment=failed&order=${order.orderNumber}`,
    };
  },
};

module.exports = paymobService;