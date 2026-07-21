const express  = require("express");
const router   = express.Router();
const ctrl     = require("../../controllers/odoo/odooController");
const { protect, restrictTo } = require("../../middleware/auth");
const { apiKeyAuth }          = require("../../middleware/b2bAuth");
const validate = require("../../middleware/validate");
const {
  saveConfigValidation,
  createMappingValidation,
  inboundEventValidation,
} = require("../../validations/odoo/odooValidation");
const { ROLES } = require("../../utils/constants");

// ── Inbound from Odoo — authenticated by API key ───────────────────────────
router.post("/inbound", apiKeyAuth, inboundEventValidation, validate, ctrl.odooInbound);

// ── All other routes require admin JWT ────────────────────────────────────
router.use(protect, restrictTo(ROLES.ADMIN));

// Config (global admin — for platform-wide or per-company)
router.post(  "/config",             saveConfigValidation, validate, ctrl.saveConfig);
router.get(   "/config",             ctrl.getConfig);
router.post(  "/test-connection",    ctrl.testConnection);

// Per-company config routes (admin managing a specific company's integration)
router.post(  "/companies/:companyId/config",          saveConfigValidation, validate, ctrl.saveConfig);
router.get(   "/companies/:companyId/config",          ctrl.getConfig);
router.post(  "/companies/:companyId/test-connection", ctrl.testConnection);

// Odoo data discovery
router.get(   "/companies/:companyId/odoo-products",   ctrl.getOdooProducts);
router.get(   "/companies/:companyId/warehouses",      ctrl.getOdooWarehouses);
router.get(   "/companies/:companyId/locations",       ctrl.getOdooLocations);

// Product mappings
router.post(  "/companies/:companyId/mappings",              createMappingValidation, validate, ctrl.createMapping);
router.get(   "/companies/:companyId/mappings",              ctrl.getMappings);
router.delete("/companies/:companyId/mappings/:mappingId",   ctrl.deleteMapping);
router.patch( "/companies/:companyId/mappings/:mappingId/toggle", ctrl.toggleMapping);

// Manual sync triggers
router.post(  "/companies/:companyId/sync/full",       ctrl.triggerFullSync);
router.post(  "/companies/:companyId/sync/reconcile",  ctrl.triggerReconcile);
router.post(  "/companies/:companyId/sync/retry",      ctrl.retryFailed);

// Sync logs
router.get(   "/companies/:companyId/sync-logs",       ctrl.getSyncLogs);

// Odoo script generator
router.get(   "/companies/:companyId/odoo-script",     ctrl.getOdooScript);

module.exports = router;
