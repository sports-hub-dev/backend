const { body } = require("express-validator");

const createOrderValidation = [
  body("customerInfo.name").trim().notEmpty().withMessage("Customer name is required"),
  body("customerInfo.email").trim().isEmail().withMessage("Valid customer email is required"),
  body("customerInfo.phone").trim().notEmpty().withMessage("Customer phone is required"),
  body("shippingAddress.fullName").trim().notEmpty().withMessage("Shipping full name is required"),
  body("shippingAddress.phoneNumber").trim().notEmpty().withMessage("Shipping phone is required"),
  body("shippingAddress.city").trim().notEmpty().withMessage("City is required"),
  body("shippingAddress.area").trim().notEmpty().withMessage("Area is required"),
  body("shippingAddress.street").trim().notEmpty().withMessage("Street is required"),
  body("items").isArray({ min: 1 }).withMessage("Order must have at least one item"),
  body("items.*.product").notEmpty().isMongoId().withMessage("Invalid product ID"),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("promoCode").optional().trim(),
];

const updateOrderStatusValidation = [
  body("status")
    .notEmpty()
    .isIn(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"])
    .withMessage("Invalid order status"),
  body("notes").optional().trim(),
];

module.exports = { createOrderValidation, updateOrderStatusValidation };
