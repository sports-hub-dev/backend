const orderService = require("../services/orderService");
const { SUPPORTED_CURRENCIES, isSupportedCurrency } = require("../utils/currency");
const Settings = require("../models/Settings");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/apiResponse");

exports.getAllSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.find().select("-updatedBy");
  successResponse(res, 200, "Settings fetched", { settings });
});

exports.updateSetting = asyncHandler(async (req, res) => {
  const { key, value, description } = req.body;
  const setting = await Settings.findOneAndUpdate(
    { key },
    { value, description, updatedBy: req.user._id },
    { upsert: true, new: true, runValidators: true }
  );
  successResponse(res, 200, "Setting updated", { setting });
});

// ?currency=SAR → that currency's fee. Also returns every currency's fee (null = not set up).
exports.getShippingFee = asyncHandler(async (req, res) => {
  const currency = isSupportedCurrency(req.query.currency) ? req.query.currency : "EGP";
  const fees = {};
  for (const c of SUPPORTED_CURRENCIES) fees[c] = await orderService.getShippingFee(c);
  successResponse(res, 200, "Shipping fee fetched", { shippingFee: fees[currency], currency, fees });
});
