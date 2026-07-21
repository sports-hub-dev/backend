const { body, query } = require("express-validator");
const { COMPANY_ROLES, PRICING_TIERS } = require("../../utils/constants");

const createCompanyValidation = [
  body("name").trim().notEmpty().withMessage("Company name is required").isLength({ max: 200 }),
  body("email").trim().isEmail().withMessage("Valid company email is required").normalizeEmail(),
  body("phone").optional().trim().notEmpty(),
  body("taxId").optional().trim(),
  body("billingAddress.city").optional().trim().notEmpty().withMessage("City is required"),
  body("billingAddress.street").optional().trim().notEmpty().withMessage("Street is required"),
  body("paymentTermsDays").optional().isIn([0, 15, 30, 60, 90]).withMessage("Payment terms must be 0, 15, 30, 60, or 90"),
  body("creditLimit").optional().isFloat({ min: 0 }).withMessage("Credit limit must be a positive number"),
];

const updateCompanyValidation = [
  body("name").optional().trim().notEmpty().isLength({ max: 200 }),
  body("phone").optional().trim().notEmpty(),
  body("approvalRules.autoApproveBelow").optional().isFloat({ min: 0 }),
  body("approvalRules.stage1Threshold").optional().isFloat({ min: 0 }),
  body("approvalRules.stage2Threshold").optional().isFloat({ min: 0 }),
];

const inviteEmployeeValidation = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("companyRole")
    .isIn(Object.values(COMPANY_ROLES))
    .withMessage(`Role must be one of: ${Object.values(COMPANY_ROLES).join(", ")}`),
];

const acceptInvitationValidation = [
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must include uppercase, lowercase and a number"),
];

const assignTierValidation = [
  body("pricingTier")
    .isIn(Object.values(PRICING_TIERS))
    .withMessage(`Tier must be one of: ${Object.values(PRICING_TIERS).join(", ")}`),
];

const priceOverrideValidation = [
  body("productId").notEmpty().isMongoId().withMessage("Valid product ID is required"),
  body("customPrice").isFloat({ min: 0 }).withMessage("Custom price must be a positive number"),
  body("validFrom").optional().isISO8601().withMessage("Valid ISO date required"),
  body("validTo").optional().isISO8601().withMessage("Valid ISO date required"),
];

const upsertTierValidation = [
  body("name").isIn(Object.values(PRICING_TIERS)).withMessage("Invalid tier name"),
  body("label").trim().notEmpty().withMessage("Label is required"),
  body("discountPercentage").isFloat({ min: 0, max: 100 }).withMessage("Discount must be 0–100"),
  body("paymentTermsDays").isIn([0, 15, 30, 60, 90]).withMessage("Payment terms must be 0, 15, 30, 60, or 90"),
];

module.exports = {
  createCompanyValidation,
  updateCompanyValidation,
  inviteEmployeeValidation,
  acceptInvitationValidation,
  assignTierValidation,
  priceOverrideValidation,
  upsertTierValidation,
};
