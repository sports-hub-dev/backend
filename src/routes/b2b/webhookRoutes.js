const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/b2b/webhookController");
const { protect, restrictTo } = require("../../middleware/auth");
const { requireCompany } = require("../../middleware/b2bAuth");
const { apiKeyAuth } = require("../../middleware/b2bAuth");
const { ROLES } = require("../../utils/constants");

// ERP inbound — authenticated by API key, not JWT
router.post("/erp/inbound", apiKeyAuth, ctrl.erpInbound);

router.use(protect);

// Webhooks (company owner or admin)
router.post("/",        requireCompany, ctrl.createWebhook);
router.get( "/",        requireCompany, ctrl.getWebhooks);
router.patch("/:id/toggle", requireCompany, ctrl.toggleWebhook);
router.delete("/:id",   requireCompany, ctrl.deleteWebhook);

// API Keys
router.post( "/api-keys",        requireCompany, ctrl.createApiKey);
router.get(  "/api-keys",        requireCompany, ctrl.getApiKeys);
router.delete("/api-keys/:id",   requireCompany, ctrl.revokeApiKey);

// Admin manage any company's webhooks and keys
router.post( "/companies/:companyId/webhooks",          restrictTo(ROLES.ADMIN), ctrl.createWebhook);
router.get(  "/companies/:companyId/webhooks",          restrictTo(ROLES.ADMIN), ctrl.getWebhooks);
router.post( "/companies/:companyId/api-keys",          restrictTo(ROLES.ADMIN), ctrl.createApiKey);
router.get(  "/companies/:companyId/api-keys",          restrictTo(ROLES.ADMIN), ctrl.getApiKeys);

module.exports = router;
