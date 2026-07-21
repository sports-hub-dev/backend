const { body, query } = require("express-validator");

const saveConfigValidation = [
  body("odooUrl")
    .trim().notEmpty().withMessage("Odoo URL is required")
    .isURL({ require_protocol: true }).withMessage("Must be a valid URL (include https://)"),
  body("odooDatabase")
    .trim().notEmpty().withMessage("Odoo database name is required"),
  body("odooVersion")
    .optional().isIn([14, 15, 16, 17]).withMessage("Supported Odoo versions: 14, 15, 16, 17"),
  body("apiKey")
    .optional().trim(),
  body("username")
    .optional().trim(),
  body("syncEnabled")
    .optional().isBoolean(),
  body("inboundSyncEnabled")
    .optional().isBoolean(),
  body("outboundSyncEnabled")
    .optional().isBoolean(),
  body("reconcileEnabled")
    .optional().isBoolean(),
  body("reconcileSchedule")
    .optional().trim()
    .custom((val) => {
      const cron = require("node-cron");
      if (val && !cron.validate(val)) throw new Error("Invalid cron expression");
      return true;
    }),
  body("sourceOfTruth")
    .optional().isIn(["sportshub", "odoo"]).withMessage("sourceOfTruth must be 'sportshub' or 'odoo'"),
  body("defaultLocationId")
    .optional().isInt({ min: 1 }).withMessage("defaultLocationId must be a positive integer"),
];

const createMappingValidation = [
  body("sportsHubProductId")
    .notEmpty().isMongoId().withMessage("Valid Sports Hub product ID required"),
  body("sportsHubSize")
    .optional().trim(),
  body("odooProductId")
    .notEmpty().isInt({ min: 1 }).withMessage("Valid Odoo product ID (integer) required"),
  body("odooProductName")
    .optional().trim(),
  body("odooDefaultCode")
    .optional().trim(),
  body("odooLocationId")
    .optional().isInt({ min: 1 }),
];

const inboundEventValidation = [
  body("event")
    .notEmpty().withMessage("event is required"),
  body("payload")
    .notEmpty().withMessage("payload is required"),
];

module.exports = { saveConfigValidation, createMappingValidation, inboundEventValidation };
