const express = require("express");
const router  = express.Router();
const productController = require("../controllers/productController");
const { protect, restrictTo, optionalAuth } = require("../middleware/auth");
const upload      = require("../middleware/upload");
const { uploadLimiter } = require("../middleware/rateLimiter");
const validate    = require("../middleware/validate");
const { createProductValidation, updateProductValidation, productQueryValidation } = require("../validations/productValidation");
const { ROLES }   = require("../utils/constants");

// ── Public routes — optionalAuth attaches user if token present ────────────
// This allows vendor users to see their vendor-specific products
router.get("/",     optionalAuth, productQueryValidation, validate, productController.getProducts);
router.get("/:id",  optionalAuth, productController.getProductById);

// ── Admin only ─────────────────────────────────────────────────────────────
router.use(protect, restrictTo(ROLES.ADMIN));

router.get( "/admin/all",             productController.adminGetProducts);
router.get( "/admin/inventory-logs",  productController.getInventoryLogs);
router.post("/",                       upload.single("mainImage"), createProductValidation, validate, productController.createProduct);
router.patch("/:id",                   upload.single("mainImage"), updateProductValidation,  validate, productController.updateProduct);
router.delete("/:id",                  productController.deleteProduct);
router.patch("/:id/restore",           productController.restoreProduct);
router.post( "/:id/images",            uploadLimiter, upload.array("images", 5), productController.uploadAdditionalImages);
router.patch("/:id/stock",             productController.updateStock);

module.exports = router;
