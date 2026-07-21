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

exports.getShippingFee = asyncHandler(async (req, res) => {
  const fee = await Settings.getValue("shippingFee", 75);
  successResponse(res, 200, "Shipping fee fetched", { shippingFee: fee, currency: "EGP" });
});
