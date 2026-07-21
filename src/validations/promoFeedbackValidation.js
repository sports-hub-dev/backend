const { body } = require("express-validator");

const promoCodeValidation = [
  body("code")
    .trim().notEmpty().withMessage("Promo code is required")
    .isAlphanumeric().withMessage("Code must be alphanumeric")
    .isLength({ min: 3, max: 20 }).withMessage("Code must be 3-20 characters"),
  body("discountPercentage")
    .isFloat({ min: 1, max: 100 }).withMessage("Discount must be between 1% and 100%"),
  body("startDate").isISO8601().withMessage("Valid start date is required"),
  body("endDate")
    .isISO8601().withMessage("Valid end date is required")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate))
        throw new Error("End date must be after start date");
      return true;
    }),
  body("usageLimit").optional().isInt({ min: 1 }).withMessage("Usage limit must be a positive integer"),
];

const feedbackValidation = [
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 100 }),
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("message")
    .trim().notEmpty().withMessage("Message is required")
    .isLength({ min: 10, max: 1000 }).withMessage("Message must be 10-1000 characters"),
];

module.exports = { promoCodeValidation, feedbackValidation };
