const authService = require("../services/authService");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/apiResponse");

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ── Regular customer register ──────────────────────────────────────────────
exports.register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  successResponse(res, 201, "Registration successful", { user });
});

// ── Vendor user register ───────────────────────────────────────────────────
// User selects which vendor they belong to — account is locked until admin approves.
exports.registerVendorUser = asyncHandler(async (req, res) => {
  const result = await authService.registerVendorUser(req.body);
  successResponse(res, 201, result.message, { user: result.user });
});

// ── Login ──────────────────────────────────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const meta = { userAgent: req.headers["user-agent"], ip: req.ip };
  const { user, accessToken, refreshToken } = await authService.login(req.body.email, req.body.password, meta);
  res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
  successResponse(res, 200, "Login successful", { user, accessToken, refreshToken });
});

// ── Logout ─────────────────────────────────────────────────────────────────
exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (req.user && token) await authService.logout(req.user._id, token);
  res.clearCookie("refreshToken");
  successResponse(res, 200, "Logged out successfully");
});

// ── Refresh token ──────────────────────────────────────────────────────────
exports.refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: "Refresh token required" });
  const meta = { userAgent: req.headers["user-agent"], ip: req.ip };
  const { accessToken, refreshToken } = await authService.refreshTokens(token, meta);
  res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
  successResponse(res, 200, "Token refreshed", { accessToken, refreshToken });
});

// ── Forgot / Reset password ────────────────────────────────────────────────
exports.forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  successResponse(res, 200, "If that email exists, a reset link has been sent.");
});

exports.resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.params.token, req.body.password);
  successResponse(res, 200, "Password reset successful. Please log in.");
});

// ── Profile ────────────────────────────────────────────────────────────────
exports.getMe = asyncHandler(async (req, res) => {
  successResponse(res, 200, "Profile fetched", { user: req.user.toSafeObject() });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phoneNumber } = req.body;
  const user = req.user;
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phoneNumber) user.phoneNumber = phoneNumber;
  await user.save({ validateBeforeSave: false });
  successResponse(res, 200, "Profile updated", { user: user.toSafeObject() });
});

// ── Addresses ──────────────────────────────────────────────────────────────
exports.addAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  user.addresses.push(req.body);
  await user.save({ validateBeforeSave: false });
  successResponse(res, 201, "Address added", { addresses: user.addresses });
});

exports.updateAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  const address = user.addresses.id(req.params.addressId);
  if (!address) return res.status(404).json({ success: false, message: "Address not found" });
  if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  Object.assign(address, req.body);
  await user.save({ validateBeforeSave: false });
  successResponse(res, 200, "Address updated", { addresses: user.addresses });
});

exports.deleteAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  user.addresses = user.addresses.filter((a) => a._id.toString() !== req.params.addressId);
  await user.save({ validateBeforeSave: false });
  successResponse(res, 200, "Address removed", { addresses: user.addresses });
});
