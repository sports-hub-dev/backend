const { body } = require("express-validator");

const createRequestValidation = [
  body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
  body("items.*.productId").notEmpty().isMongoId().withMessage("Valid product ID is required"),
  body("items.*.name").trim().notEmpty().withMessage("Product name is required"),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("notes").optional().trim().isLength({ max: 1000 }),
];

const approveRejectValidation = [
  body("notes").optional().trim().isLength({ max: 500 }),
];

const rejectValidation = [
  body("reason").trim().notEmpty().withMessage("Rejection reason is required").isLength({ max: 500 }),
];

const convertToPOValidation = [
  body("shippingAddress.fullName").trim().notEmpty().withMessage("Full name is required"),
  body("shippingAddress.phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
  body("shippingAddress.city").trim().notEmpty().withMessage("City is required"),
  body("shippingAddress.area").trim().notEmpty().withMessage("Area is required"),
  body("shippingAddress.street").trim().notEmpty().withMessage("Street is required"),
];

module.exports = {
  createRequestValidation,
  approveRejectValidation,
  rejectValidation,
  convertToPOValidation,
};
