const express  = require("express");
const router   = express.Router();
const ctrl     = require("../../controllers/b2b/purchaseRequestController");
const { protect, restrictTo }          = require("../../middleware/auth");
const { requireCompany, restrictToCompanyRole } = require("../../middleware/b2bAuth");
const validate = require("../../middleware/validate");
const {
  createRequestValidation,
  approveRejectValidation,
  rejectValidation,
  convertToPOValidation,
} = require("../../validations/b2b/purchaseRequestValidation");
const { ROLES, COMPANY_ROLES } = require("../../utils/constants");

router.use(protect, requireCompany);

router.post("/",              createRequestValidation, validate, ctrl.createRequest);
router.post("/:id/submit",    ctrl.submitRequest);
router.post("/:id/cancel",    ctrl.cancelRequest);
router.get( "/my",            ctrl.getMyRequests);
router.get( "/company",       ctrl.getCompanyRequests);
router.get( "/:id",           ctrl.getRequestById);

// Manager / Owner only
router.post("/:id/approve",
  restrictToCompanyRole(COMPANY_ROLES.MANAGER, COMPANY_ROLES.OWNER),
  approveRejectValidation, validate, ctrl.approveRequest);

router.post("/:id/reject",
  restrictToCompanyRole(COMPANY_ROLES.MANAGER, COMPANY_ROLES.OWNER),
  rejectValidation, validate, ctrl.rejectRequest);

// Admin only — convert approved request → PO
router.post("/:id/convert-to-po",
  restrictTo(ROLES.ADMIN), convertToPOValidation, validate, ctrl.convertToPO);

// Admin — all requests across all companies
router.get("/admin/all", restrictTo(ROLES.ADMIN), ctrl.getCompanyRequests);

module.exports = router;
