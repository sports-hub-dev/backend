const PromoCode = require("../models/PromoCode");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { successResponse, paginatedResponse } = require("../utils/apiResponse");

exports.createPromoCode = asyncHandler(async (req, res) => {
  const promo = await PromoCode.create({ ...req.body, code: req.body.code.toUpperCase(), createdBy: req.user._id });
  successResponse(res, 201, "Promo code created", { promo });
});

exports.updatePromoCode = asyncHandler(async (req, res) => {
  const promo = await PromoCode.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!promo) throw new AppError("Promo code not found", 404);
  successResponse(res, 200, "Promo code updated", { promo });
});

exports.deletePromoCode = asyncHandler(async (req, res) => {
  const promo = await PromoCode.findByIdAndDelete(req.params.id);
  if (!promo) throw new AppError("Promo code not found", 404);
  successResponse(res, 200, "Promo code deleted");
});

exports.togglePromoCode = asyncHandler(async (req, res) => {
  const promo = await PromoCode.findById(req.params.id);
  if (!promo) throw new AppError("Promo code not found", 404);
  promo.isActive = !promo.isActive;
  await promo.save();
  successResponse(res, 200, `Promo code ${promo.isActive ? "activated" : "deactivated"}`, { promo });
});

exports.getAllPromoCodes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  const [promos, total] = await Promise.all([
    PromoCode.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    PromoCode.countDocuments(),
  ]);
  paginatedResponse(res, "Promo codes fetched", promos, page, limit, total);
});

exports.validatePromoCode = asyncHandler(async (req, res) => {
  const promo = await PromoCode.findOne({ code: req.body.code?.toUpperCase() });
  if (!promo || !promo.isValid) throw new AppError("Invalid or expired promo code", 400);
  successResponse(res, 200, "Promo code is valid", {
    code: promo.code,
    discountPercentage: promo.discountPercentage,
  });
});
