const { body } = require("express-validator");
const { PO_STATUS } = require("../../utils/constants");

const updatePOStatusValidation = [
  body("status")
    .notEmpty()
    .isIn(Object.values(PO_STATUS))
    .withMessage(`Status must be one of: ${Object.values(PO_STATUS).join(", ")}`),
  body("notes").optional().trim().isLength({ max: 500 }),
  body("trackingNumber").optional().trim(),
  body("carrier").optional().trim(),
];

const generateInvoiceValidation = [
  body("vatRate").optional().isFloat({ min: 0, max: 100 }).withMessage("VAT rate must be 0–100"),
];

const markPaidValidation = [
  body("paymentRef").trim().notEmpty().withMessage("Payment reference is required"),
];

module.exports = {
  updatePOStatusValidation,
  generateInvoiceValidation,
  markPaidValidation,
};
