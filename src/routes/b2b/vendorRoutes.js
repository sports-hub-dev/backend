const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/b2b/vendorController");
const { protect, restrictTo } = require("../../middleware/auth");
const { ROLES } = require("../../utils/constants");

// ── Public — frontend uses this to show vendor selector on register page ──
router.get("/active", ctrl.getActiveVendors);

// ── Admin only ─────────────────────────────────────────────────────────────
router.use(protect, restrictTo(ROLES.ADMIN));
router.get("/",                        ctrl.getAllVendors);
router.post("/",                       ctrl.createVendor);
router.get("/:id",                     ctrl.getVendorById);
router.patch("/:id",                   ctrl.updateVendor);
router.patch("/:id/toggle-status",     ctrl.toggleVendorStatus);
router.get("/:id/products",            ctrl.getVendorProducts);
router.get("/:id/users",               ctrl.getVendorUsers);

module.exports = router;
