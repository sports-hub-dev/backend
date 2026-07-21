const express  = require("express");
const router   = express.Router();
const ctrl     = require("../../controllers/b2b/purchaseOrderController");
const { protect, restrictTo } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const {
  updatePOStatusValidation,
  generateInvoiceValidation,
  markPaidValidation,
} = require("../../validations/b2b/purchaseOrderValidation");
const { ROLES } = require("../../utils/constants");

router.use(protect);

router.get( "/",     ctrl.getAllPOs);
router.get( "/:id",  ctrl.getPOById);

router.patch("/:id/status",
  restrictTo(ROLES.ADMIN), updatePOStatusValidation, validate, ctrl.updatePOStatus);

router.post("/:id/generate-invoice",
  restrictTo(ROLES.ADMIN), generateInvoiceValidation, validate, ctrl.generateInvoice);

router.post("/:id/mark-paid",
  restrictTo(ROLES.ADMIN), markPaidValidation, validate, ctrl.markPOPaid);

module.exports = router;
