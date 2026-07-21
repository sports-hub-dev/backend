const analyticsService = require("../services/analyticsService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

exports.getDateRangeAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) throw new AppError("startDate and endDate are required", 400);
  const data = await analyticsService.getDateRangeAnalytics(startDate, endDate);
  successResponse(res, 200, "Analytics fetched", data);
});

exports.getProductAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getProductAnalytics(req.params.productId);
  successResponse(res, 200, "Product analytics fetched", data);
});

exports.getRevenueByPeriod = asyncHandler(async (req, res) => {
  const { period = "daily", limit = 30 } = req.query;
  const data = await analyticsService.getRevenueByPeriod(period, parseInt(limit));
  successResponse(res, 200, "Revenue analytics fetched", { revenue: data });
});

exports.getLowStockProducts = asyncHandler(async (req, res) => {
  const { threshold = 5 } = req.query;
  const data = await analyticsService.getLowStockProducts(parseInt(threshold));
  successResponse(res, 200, "Low stock products fetched", { products: data });
});

exports.getOrderStatusBreakdown = asyncHandler(async (req, res) => {
  const data = await analyticsService.getOrderStatusBreakdown();
  successResponse(res, 200, "Order status breakdown fetched", { breakdown: data });
});

exports.getPromoCodeUsage = asyncHandler(async (req, res) => {
  const data = await analyticsService.getPromoCodeUsage();
  successResponse(res, 200, "Promo code analytics fetched", { promoCodes: data });
});

exports.getCustomerAnalytics = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const data = await analyticsService.getCustomerRegistrationAnalytics(parseInt(days));
  successResponse(res, 200, "Customer analytics fetched", { registrations: data });
});
