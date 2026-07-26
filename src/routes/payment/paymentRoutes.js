const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/payment/paymentController");
const { protect, restrictTo } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { createPaymentOrderValidation } = require("../../validations/payment/paymentValidation");
const { ROLES } = require("../../utils/constants");

// ── Public — no auth, called by the gateways themselves, not your frontend ──
router.post("/aps/return", ctrl.apsReturn);
router.get("/aps/return", ctrl.apsReturn); // fallback, in case your APS account sends GET
router.post("/stripe/webhook", ctrl.stripeWebhook);

// ── Authenticated — called by your logged-in frontend ───────────────────────
router.use(protect);

router.post("/aps/create-order", createPaymentOrderValidation, validate, ctrl.createApsOrder);
router.post("/stripe/create-order", createPaymentOrderValidation, validate, ctrl.createStripeOrder);

router.get("/status/:orderId", ctrl.getPaymentStatus);

// ── Admin only ───────────────────────────────────────────────────────────────
router.post("/stripe/refund/:orderId", restrictTo(ROLES.ADMIN), ctrl.stripeRefund);

module.exports = router;