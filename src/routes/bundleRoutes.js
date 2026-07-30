const express = require("express");
const router = express.Router();
const bundleController = require("../controllers/bundleController");
const { protect, restrictTo } = require("../middleware/auth");
const upload = require("../middleware/upload");
const validate = require("../middleware/validate");
const { createBundleValidation } = require("../validations/bundleValidation");
const { ROLES } = require("../utils/constants");

router.get("/", bundleController.getBundles);
router.get("/:id", bundleController.getBundleById);

router.use(protect, restrictTo(ROLES.ADMIN));
router.post("/", upload.single("mainImage"), createBundleValidation, validate, bundleController.createBundle);
router.patch("/:id", upload.single("mainImage"), bundleController.updateBundle);
router.delete("/:id", bundleController.deleteBundle);

module.exports = router;