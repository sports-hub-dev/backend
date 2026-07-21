const crypto   = require("crypto");
const Order    = require("../../models/Order");
const AppError = require("../../utils/AppError");
const logger   = require("../../utils/logger");

// APS sandbox vs production base URL — confirm the exact production hostname
// against your APS merchant dashboard before going live; sandbox is documented
// as https://sbcheckout.payfort.com/FortAPI/paymentPage
const APS_CHECKOUT_URL =
  process.env.APS_ENVIRONMENT === "production"
    ? process.env.APS_PRODUCTION_CHECKOUT_URL // set this once APS gives you the live URL
    : "https://sbcheckout.payfort.com/FortAPI/paymentPage";

const apsService = {
  /**
   * APS requires every request (and validates every response) via a SHA
   * signature: sort all params alphabetically by key, concatenate as
   * `key=value` pairs surrounded by a shared secret "SHA phrase", then hash.
   *
   * NOTE: confirm the exact hash algorithm (SHA-256 vs SHA-512) configured
   * for your merchant account in the APS dashboard — this defaults to
   * SHA-256, the more commonly documented default, but your account may be
   * configured differently.
   */
  _buildSignature(params, phrase) {
    const sortedKeys = Object.keys(params)
      .filter((key) => key !== "signature" && params[key] !== undefined && params[key] !== null)
      .sort();

    const concatenated = sortedKeys.reduce((acc, key) => `${acc}${key}=${params[key]}`, phrase) + phrase;

    return crypto.createHash("sha256").update(concatenated).digest("hex");
  },

  /**
   * Main entry — called by the controller after the order is created.
   * Builds the signed hidden-field set the frontend auto-submits as a POST
   * form to APS's hosted checkout page.
   */
  async initiatePayment(orderId) {
    const order = await Order.findById(orderId);
    if (!order)                          throw new AppError("Order not found", 404);
    if (order.paymentStatus === "paid")  throw new AppError("Order is already paid", 400);

    const { APS_ACCESS_CODE, APS_MERCHANT_IDENTIFIER, APS_SHA_REQUEST_PHRASE, BASE_URL } = process.env;
    if (!APS_ACCESS_CODE || !APS_MERCHANT_IDENTIFIER || !APS_SHA_REQUEST_PHRASE) {
      throw new AppError("Amazon Payment Services is not configured. Add APS_* vars to .env", 500);
    }

    // APS amounts are in the currency's smallest unit — EGP uses 2 decimal
    // places, so piastres (same convention as the existing Paymob amount_cents).
    const amount = Math.round(order.total * 100);

    const fields = {
      command: "PURCHASE",
      access_code: APS_ACCESS_CODE,
      merchant_identifier: APS_MERCHANT_IDENTIFIER,
      merchant_reference: order.orderNumber, // APS's own idempotency key too — must be unique per attempt in some configurations; confirm retry behavior with APS support
      amount: String(amount),
      currency: "EGP",
      language: "en",
      customer_email: order.customerInfo.email,
      customer_name: order.customerInfo.name,
      order_description: `Sports Hub order ${order.orderNumber}`,
      // This must point at YOUR backend, not the frontend directly — the
      // signature has to be verified server-side before we know the result.
      return_url: `${BASE_URL}/api/v1/payments/aps/return`,
    };

    fields.signature = this._buildSignature(fields, APS_SHA_REQUEST_PHRASE);

    order.paymentMethod = "aps";
    await order.save();

    logger.info(`APS payment initiated for order ${order.orderNumber}`);

    return {
      checkoutUrl: APS_CHECKOUT_URL,
      formFields: fields,
    };
  },

  /**
   * Verifies an incoming response's signature using the SHA *response*
   * phrase (APS gives you two separate phrases — request and response —
   * do not reuse the request phrase here).
   */
  verifySignature(data) {
    const { APS_SHA_RESPONSE_PHRASE } = process.env;
    if (!APS_SHA_RESPONSE_PHRASE) throw new AppError("APS_SHA_RESPONSE_PHRASE not configured", 500);

    const { signature, ...rest } = data;
    const computed = this._buildSignature(rest, APS_SHA_RESPONSE_PHRASE);
    return computed === signature;
  },

  /**
   * Handles APS's browser return — the customer's browser is redirected
   * here (as a POST, per APS's hosted-checkout convention) after completing
   * or abandoning payment on APS's page. Confirm your specific merchant
   * account is configured to send this as a POST rather than a GET.
   */
  async handleReturn(body) {
    const isValid = this.verifySignature(body);
    if (!isValid) {
      throw new AppError("Invalid Amazon Payment Services signature", 401);
    }

    const merchantReference = body.merchant_reference;
    const order = await Order.findOne({ orderNumber: merchantReference });
    if (!order) {
      logger.warn(`APS return: no order found for ${merchantReference}`);
      return { success: false, redirectUrl: `${process.env.CLIENT_URL}/checkout?payment=failed` };
    }

    // APS uses response_code / status rather than a plain boolean — "14000"
    // is APS's documented code for a successful purchase; confirm this
    // against the current API reference for your account/integration version.
    const isSuccess = body.response_code === "14000" || body.status === "14";

    order.apsFortId = body.fort_id;
    order.paymentReference = body.fort_id;

    if (isSuccess) {
      order.paymentStatus = "paid";
      order.paidAt = new Date();
      if (order.status === "pending") {
        order.status = "confirmed";
        order.timeline.push({
          previousStatus: "pending",
          newStatus: "confirmed",
          changedByName: "Amazon Payment Services",
          notes: `Payment confirmed — APS fort_id: ${body.fort_id}`,
        });
      }
      logger.info(`Order ${order.orderNumber} marked PAID via APS`);
    } else {
      order.paymentStatus = "failed";
      logger.warn(`Order ${order.orderNumber} payment FAILED via APS — response_code: ${body.response_code}`);
    }

    await order.save();

    return {
      success: isSuccess,
      redirectUrl: isSuccess
        ? `${process.env.CLIENT_URL}/orders/${order._id}?payment=success`
        : `${process.env.CLIENT_URL}/checkout?payment=failed&order=${order.orderNumber}`,
    };
  },
};

module.exports = apsService;