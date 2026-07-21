const express = require("express");
const router  = express.Router();
const authController = require("../controllers/authController");
const { protect }    = require("../middleware/auth");
const { authLimiter }= require("../middleware/rateLimiter");
const validate       = require("../middleware/validate");
const {
  registerValidation,
  registerVendorUserValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
  addressValidation,
} = require("../validations/authValidation");

// ── Public auth ────────────────────────────────────────────────────────────
router.post("/register",         authLimiter, registerValidation,           validate, authController.register);
router.post("/register/vendor",  authLimiter, registerVendorUserValidation,  validate, authController.registerVendorUser);
router.post("/login",            authLimiter, loginValidation,              validate, authController.login);
router.post("/refresh-token",    authController.refreshToken);
router.post("/forgot-password",  authLimiter, forgotPasswordValidation,     validate, authController.forgotPassword);
router.post("/reset-password/:token", resetPasswordValidation,              validate, authController.resetPassword);

// ── Protected profile ──────────────────────────────────────────────────────
router.post("/logout",                     protect, authController.logout);
router.get( "/me",                         protect, authController.getMe);
router.patch("/me",                        protect, updateProfileValidation, validate, authController.updateProfile);
router.post( "/me/addresses",              protect, addressValidation,       validate, authController.addAddress);
router.patch("/me/addresses/:addressId",   protect, authController.updateAddress);
router.delete("/me/addresses/:addressId",  protect, authController.deleteAddress);

module.exports = router;
