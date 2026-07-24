const { body } = require("express-validator");

const registerValidation = [
  body("firstName").trim().notEmpty().withMessage("First name is required").isLength({ max: 50 }),
  body("lastName").trim().notEmpty().withMessage("Last name is required").isLength({ max: 50 }),
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage("Password must contain uppercase, lowercase, and a number"),
  body("phoneNumber").optional().trim().isNumeric().withMessage("Phone number must contain digits only").isLength({ min: 7, max: 15 }).withMessage("Phone number must be between 7 and 15 digits"),
];

// Vendor user registration adds required vendorId
const registerVendorUserValidation = [
  body("firstName").trim().notEmpty().withMessage("First name is required").isLength({ max: 50 }),
  body("lastName").trim().notEmpty().withMessage("Last name is required").isLength({ max: 50 }),
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage("Password must contain uppercase, lowercase, and a number"),
  body("phoneNumber").optional().trim().isNumeric().withMessage("Phone number must contain digits only").isLength({ min: 7, max: 15 }).withMessage("Phone number must be between 7 and 15 digits"),
  body("vendorId").notEmpty().isMongoId().withMessage("Valid vendor ID is required"),
];

const loginValidation = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const forgotPasswordValidation = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
];

const resetPasswordValidation = [
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage("Password must contain uppercase, lowercase, and a number"),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) throw new Error("Passwords do not match");
    return true;
  }),
];

const updateProfileValidation = [
  body("firstName").optional().trim().notEmpty().isLength({ max: 50 }),
  body("lastName").optional().trim().notEmpty().isLength({ max: 50 }),
  body("phoneNumber").optional().trim().isNumeric().withMessage("Phone number must contain digits only").isLength({ min: 7, max: 15 }).withMessage("Phone number must be between 7 and 15 digits"),
];

const addressValidation = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
  body("city").trim().notEmpty().withMessage("City is required"),
  body("area").trim().notEmpty().withMessage("Area is required"),
  body("street").trim().notEmpty().withMessage("Street is required"),
];

module.exports = {
  registerValidation,
  registerVendorUserValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
  addressValidation,
};
