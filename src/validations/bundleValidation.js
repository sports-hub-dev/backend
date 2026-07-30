const { body } = require("express-validator");

const createBundleValidation = [
    body("name").trim().notEmpty().withMessage("Bundle name is required"),
    body("discountPercentage").isFloat({ min: 0, max: 100 }).withMessage("Discount must be 0-100"),
    body("products").custom((value) => {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (!Array.isArray(parsed) || parsed.length < 2) throw new Error("A bundle needs at least 2 products");
        return true;
    }),
];

module.exports = { createBundleValidation };