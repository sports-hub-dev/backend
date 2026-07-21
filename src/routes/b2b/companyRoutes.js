const express  = require("express");
const router   = express.Router();
const ctrl     = require("../../controllers/b2b/companyController");
const { protect, restrictTo }             = require("../../middleware/auth");
const { requireCompany, restrictToCompanyRole, ownCompanyOnly } = require("../../middleware/b2bAuth");
const validate = require("../../middleware/validate");
const {
  createCompanyValidation, updateCompanyValidation,
  inviteEmployeeValidation, acceptInvitationValidation,
  assignTierValidation, priceOverrideValidation, upsertTierValidation,
} = require("../../validations/b2b/companyValidation");
const { ROLES, COMPANY_ROLES } = require("../../utils/constants");

// ── Public ─────────────────────────────────────────────────────────────────
router.post("/invitations/:token/accept", acceptInvitationValidation, validate, ctrl.acceptInvitation);

// ── Auth required ──────────────────────────────────────────────────────────
router.use(protect);

// Pricing tier management (admin only)
router.get( "/pricing-tiers",                            restrictTo(ROLES.ADMIN), ctrl.getPricingTiers);
router.post("/pricing-tiers",                            restrictTo(ROLES.ADMIN), upsertTierValidation, validate, ctrl.upsertPricingTier);
router.patch("/:companyId/pricing-tier",                 restrictTo(ROLES.ADMIN), assignTierValidation, validate, ctrl.assignPricingTier);
router.post( "/:companyId/price-overrides",              restrictTo(ROLES.ADMIN), priceOverrideValidation, validate, ctrl.setCompanyPrice);

// Audit logs (admin only)
router.get("/audit-logs",                                restrictTo(ROLES.ADMIN), ctrl.getAuditLogs);

// Price resolution for B2B user
router.get("/price/resolve",                             requireCompany, ctrl.resolvePrice);

// Admin: CRUD companies
router.get( "/",           restrictTo(ROLES.ADMIN), ctrl.getAllCompanies);
router.post("/",           restrictTo(ROLES.ADMIN), createCompanyValidation, validate, ctrl.createCompany);
router.patch("/:id/approve",  restrictTo(ROLES.ADMIN), ctrl.approveCompany);
router.patch("/:id/suspend",  restrictTo(ROLES.ADMIN), ctrl.suspendCompany);
router.get(  "/:id",      ctrl.getCompanyById);
router.patch("/:id",      updateCompanyValidation, validate, ctrl.updateCompany);

// Team management
router.post("/:companyId/invite",
  requireCompany, restrictToCompanyRole(COMPANY_ROLES.OWNER, COMPANY_ROLES.MANAGER),
  inviteEmployeeValidation, validate, ctrl.inviteEmployee);
router.get( "/:companyId/team",
  requireCompany, ownCompanyOnly, ctrl.getTeamMembers);
router.patch("/:companyId/team/:userId/role",
  requireCompany, restrictToCompanyRole(COMPANY_ROLES.OWNER), ctrl.updateMemberRole);
router.delete("/:companyId/team/:userId",
  requireCompany, restrictToCompanyRole(COMPANY_ROLES.OWNER), ctrl.revokeEmployee);

module.exports = router;
