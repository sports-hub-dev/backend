const { body, query } = require("express-validator");
const { PRODUCT_SIZES } = require("../utils/constants");

const createProductValidation = [
  body("name").trim().notEmpty().withMessage("Product name is required").isLength({ max: 200 }),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("price").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("isPublic").optional().isBoolean().withMessage("isPublic must be true or false"),
  body("vendorId")
    .if((value, { req }) => req.body.isPublic === "false" || req.body.isPublic === false)
    .notEmpty().isMongoId().withMessage("vendorId is required for vendor-specific products"),
  body("hasSizeVariants").optional(),
  body("stock")
    .if((value, { req }) => req.body.hasSizeVariants !== "true" && req.body.hasSizeVariants !== true)
    .isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),
  body("variants")
    .if((value, { req }) => req.body.hasSizeVariants === "true" || req.body.hasSizeVariants === true)
    .custom((value) => {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("At least one size variant is required");
      }
      return true;
    }),
  body("variants.*.size")
    .if((value, { req }) => req.body.hasSizeVariants === "true" || req.body.hasSizeVariants === true)
    .optional()
    .isIn(PRODUCT_SIZES).withMessage(`Size must be one of: ${PRODUCT_SIZES.join(", ")}`),
  body("variants.*.stock")
    .if((value, { req }) => req.body.hasSizeVariants === "true" || req.body.hasSizeVariants === true)
    .optional()
    .isInt({ min: 0 }).withMessage("Variant stock must be a non-negative integer"),
];

const updateProductValidation = [
  body("name").optional().trim().notEmpty().isLength({ max: 200 }),
  body("description").optional().trim().notEmpty(),
  body("price").optional().isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("category").optional().trim().notEmpty(),
  body("isPublic").optional().isBoolean(),
  body("vendorId").optional().isMongoId(),
];

const productQueryValidation = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("sort").optional().isIn(["price_asc", "price_desc", "newest", "oldest", "name_asc"]),
];

module.exports = { createProductValidation, updateProductValidation, productQueryValidation };