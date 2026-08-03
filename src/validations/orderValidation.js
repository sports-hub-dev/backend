const { body, oneOf } = require('express-validator');
const AppError = require("../utils/AppError");

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
  // body("items.*.product").notEmpty().isMongoId().withMessage("Invalid product ID"),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("promoCode").optional().trim(),
  body("items").custom((items) => {
          if (items.some((item) => !item.product && !item.bundle)) {
              throw new AppError("Each item must reference either a product or a bundle" , 403);
          }
          return true;
      }),
];

const updateOrderStatusValidation = [
  body("status")
    .notEmpty()
    .isIn(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"])
    .withMessage("Invalid order status"),
  body("notes").optional().trim(),
];

module.exports = { createOrderValidation, updateOrderStatusValidation };
