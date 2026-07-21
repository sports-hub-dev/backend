const express = require("express");

const promoController    = require("../controllers/promoCodeController");
const feedbackController = require("../controllers/feedbackController");
const contactController = require("../controllers/contactController");
const settingsController = require("../controllers/settingsController");
const analyticsController= require("../controllers/analyticsController");
const adminController    = require("../controllers/adminController");

const { protect, restrictTo, optionalAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { promoCodeValidation, feedbackValidation } = require("../validations/promoFeedbackValidation");
const { contactMessageValidation } = require("../validations/contactValidation");
const { ROLES } = require("../utils/constants");

const promoRouter = express.Router();
promoRouter.post("/validate",   promoController.validatePromoCode);
promoRouter.use(protect, restrictTo(ROLES.ADMIN));
promoRouter.get("/",            promoController.getAllPromoCodes);
promoRouter.post("/",           promoCodeValidation, validate, promoController.createPromoCode);
promoRouter.patch("/:id",       promoController.updatePromoCode);
promoRouter.delete("/:id",      promoController.deletePromoCode);
promoRouter.patch("/:id/toggle",promoController.togglePromoCode);

const feedbackRouter = express.Router();
feedbackRouter.post("/",        optionalAuth, feedbackValidation, validate, feedbackController.submitFeedback);
feedbackRouter.get("/",         protect, restrictTo(ROLES.ADMIN), feedbackController.getAllFeedback);
feedbackRouter.delete("/:id",   protect, restrictTo(ROLES.ADMIN), feedbackController.deleteFeedback);

const contactRouter = express.Router();
contactRouter.post("/",          optionalAuth, contactMessageValidation, validate, contactController.submitContactMessage);
contactRouter.get("/",           protect, restrictTo(ROLES.ADMIN), contactController.getAllContactMessages);
contactRouter.patch("/:id/read", protect, restrictTo(ROLES.ADMIN), contactController.markContactMessageRead);
contactRouter.delete("/:id",     protect, restrictTo(ROLES.ADMIN), contactController.deleteContactMessage);

const settingsRouter = express.Router();
settingsRouter.get("/shipping-fee", settingsController.getShippingFee);
settingsRouter.get("/",             protect, restrictTo(ROLES.ADMIN), settingsController.getAllSettings);
settingsRouter.post("/",            protect, restrictTo(ROLES.ADMIN), settingsController.updateSetting);

const analyticsRouter = express.Router();
analyticsRouter.use(protect, restrictTo(ROLES.ADMIN));
analyticsRouter.get("/date-range",          analyticsController.getDateRangeAnalytics);
analyticsRouter.get("/revenue",             analyticsController.getRevenueByPeriod);
analyticsRouter.get("/low-stock",           analyticsController.getLowStockProducts);
analyticsRouter.get("/order-status",        analyticsController.getOrderStatusBreakdown);
analyticsRouter.get("/promo-usage",         analyticsController.getPromoCodeUsage);
analyticsRouter.get("/customers",           analyticsController.getCustomerAnalytics);
analyticsRouter.get("/products/:productId", analyticsController.getProductAnalytics);

const adminRouter = express.Router();
adminRouter.use(protect, restrictTo(ROLES.ADMIN));
adminRouter.get("/users",                           adminController.getAllUsers);
adminRouter.get("/users/pending-vendor",            adminController.getPendingVendorUsers);
adminRouter.get("/users/:id",                       adminController.getUserById);
adminRouter.patch("/users/:id/approve-vendor",      adminController.approveVendorUser);
adminRouter.post("/users/:id/reject-vendor",        adminController.rejectVendorUser);
adminRouter.patch("/users/:id/toggle-status",       adminController.toggleUserStatus);

module.exports = { promoRouter, feedbackRouter, contactRouter, settingsRouter, analyticsRouter, adminRouter };