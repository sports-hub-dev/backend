const { body } = require("express-validator");

const createPaymentOrderValidation = [
    body("customerInfo.name").trim().notEmpty().withMessage("Customer name is required"),
    body("customerInfo.email").trim().isEmail().withMessage("Valid email is required"),
    body("customerInfo.phone").trim().notEmpty().withMessage("Customer phone is required"),

    body("shippingAddress.fullName").trim().notEmpty().withMessage("Full name is required"),
    body("shippingAddress.phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
    body("shippingAddress.city").trim().notEmpty().withMessage("City is required"),
    body("shippingAddress.area").trim().notEmpty().withMessage("Area is required"),
    body("shippingAddress.street").trim().notEmpty().withMessage("Street is required"),

    body("items").isArray({ min: 1 }).withMessage("Order must have at least one item"),
    body("items.*.product").optional().isMongoId().withMessage("Invalid product ID"),
    body("items.*.bundle").optional().isMongoId().withMessage("Invalid bundle ID"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("items").custom((items) => {
        if (items.some((item) => !item.product && !item.bundle)) {
            throw new Error("Each item must reference either a product or a bundle");
        }
        return true;
    }),

    body("promoCode").optional().trim(),
];

module.exports = { createPaymentOrderValidation };