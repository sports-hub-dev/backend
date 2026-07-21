const express = require("express");
const router  = express.Router();
const orderController = require("../controllers/orderController");
const { protect, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { createOrderValidation, updateOrderStatusValidation } = require("../validations/orderValidation");
const { ROLES } = require("../utils/constants");

// ── Public: Track order ────────────────────────────────────────────────────
router.get("/track/:orderNumber", orderController.trackOrder);

// ── User: Place order — must be logged in (no guests) ─────────────────────
router.post("/", protect, createOrderValidation, validate, orderController.createOrder);

// ── User: Own orders ───────────────────────────────────────────────────────
router.get("/my-orders",      protect, orderController.getMyOrders);
router.get("/my-orders/:id",  protect, orderController.getMyOrderById);

// ── Admin ──────────────────────────────────────────────────────────────────
router.use(protect, restrictTo(ROLES.ADMIN));
router.get("/",          orderController.getAllOrders);
router.get("/:id",       orderController.getOrderById);
router.patch("/:id/status", updateOrderStatusValidation, validate, orderController.updateOrderStatus);

module.exports = router;
