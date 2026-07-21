const { body } = require("express-validator");

const applyVendorValidation = [
  body("name").trim().notEmpty().withMessage("Vendor name is required").isLength({ max: 200 }),
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("phone").optional().trim(),
  body("description").optional().trim().isLength({ max: 1000 }),
  body("commissionRate").optional().isFloat({ min: 0, max: 100 }).withMessage("Commission rate must be 0–100"),
  body("address.city").optional().trim(),
  body("address.street").optional().trim(),
];

const rejectVendorValidation = [
  body("reason").trim().notEmpty().withMessage("Rejection reason is required"),
];

module.exports = { applyVendorValidation, rejectVendorValidation };
