const crypto  = require("crypto");
const User    = require("../models/User");
const Vendor  = require("../models/Vendor");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../utils/jwtUtils");
const AppError = require("../utils/AppError");
const { sendEmail, sendPasswordResetEmail } = require("../utils/emailUtils");
const { ROLES } = require("../utils/constants");

const authService = {

  // ── Regular customer registration ────────────────────────────────────────
  async register(data) {
    const { firstName, lastName, email, password, phoneNumber } = data;
    const existing = await User.findOne({ email });
    if (existing) throw new AppError("Email already registered", 409);

    const user = await User.create({
      firstName, lastName, email, password, phoneNumber,
      role:       ROLES.CUSTOMER,
      isApproved: true,   // regular customers are instantly active
      isActive:   true,
    });
    return user.toSafeObject();
  },

  // ── Vendor user registration ─────────────────────────────────────────────
  // User provides their vendorId (the vendor they belong to).
  // Account is created but isApproved = false → cannot log in until admin approves.
  async registerVendorUser(data) {
    const { firstName, lastName, email, password, phoneNumber, vendorId } = data;

    const existing = await User.findOne({ email });
    if (existing) throw new AppError("Email already registered", 409);

    // Validate vendor exists and is active
    const vendor = await Vendor.findById(vendorId);
    if (!vendor)           throw new AppError("Vendor not found", 404);
    if (!vendor.isActive)  throw new AppError("This vendor account is not yet approved. Contact Sports Hub.", 403);

    const user = await User.create({
      firstName, lastName, email, password, phoneNumber,
      role:       ROLES.CUSTOMER,
      vendorId:   vendor._id,
      isApproved: false,  // must wait for admin approval
      isActive:   true,   // account exists but cannot log in until approved
    });

    // Notify Sports Hub admin that a new vendor user is awaiting approval
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `New Vendor User Registration — ${vendor.name} — Awaiting Approval`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;">
            <h2 style="color:#1B2A4A;">New Vendor User Awaiting Approval</h2>
            <p>A new user has registered and is linked to <strong>${vendor.name}</strong>.</p>
            <table style="border-collapse:collapse;width:100%;">
              <tr><td style="padding:8px;border:1px solid #CBD5E1;"><strong>Name</strong></td><td style="padding:8px;border:1px solid #CBD5E1;">${firstName} ${lastName}</td></tr>
              <tr><td style="padding:8px;border:1px solid #CBD5E1;"><strong>Email</strong></td><td style="padding:8px;border:1px solid #CBD5E1;">${email}</td></tr>
              <tr><td style="padding:8px;border:1px solid #CBD5E1;"><strong>Vendor</strong></td><td style="padding:8px;border:1px solid #CBD5E1;">${vendor.name}</td></tr>
              <tr><td style="padding:8px;border:1px solid #CBD5E1;"><strong>User ID</strong></td><td style="padding:8px;border:1px solid #CBD5E1;">${user._id}</td></tr>
            </table>
            <p>Log in to the Sports Hub admin panel to approve or reject this account.</p>
          </div>`,
      }).catch(() => {}); // non-fatal
    }

    return {
      user: user.toSafeObject(),
      message: "Registration submitted. Your account is pending admin approval. You will be notified by email once approved.",
    };
  },

  // ── Login ────────────────────────────────────────────────────────────────
  async login(email, password, meta = {}) {
    const user = await User.findOne({ email, isActive: true }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError("Invalid email or password", 401);
    }

    // Vendor users must be approved before they can log in
    if (user.vendorId && !user.isApproved) {
      throw new AppError("Your account is pending approval by Sports Hub. Please check back later.", 403);
    }

    const payload      = { id: user._id, role: user.role, vendorId: user.vendorId || null };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshTokens.push({ token: refreshToken, userAgent: meta.userAgent, ip: meta.ip });
    if (user.refreshTokens.length > 5) user.refreshTokens = user.refreshTokens.slice(-5);
    await user.save({ validateBeforeSave: false });

    return { user: user.toSafeObject(), accessToken, refreshToken };
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  async logout(userId, refreshToken) {
    const user = await User.findById(userId);
    if (!user) return;
    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
    await user.save({ validateBeforeSave: false });
  },

  // ── Refresh tokens ────────────────────────────────────────────────────────
  async refreshTokens(token, meta = {}) {
    let decoded;
    try { decoded = verifyRefreshToken(token); }
    catch { throw new AppError("Invalid or expired refresh token", 401); }

    const user = await User.findById(decoded.id);
    if (!user) throw new AppError("User not found", 404);

    if (!user.refreshTokens.some((t) => t.token === token)) {
      throw new AppError("Refresh token revoked", 401);
    }

    user.refreshTokens     = user.refreshTokens.filter((t) => t.token !== token);
    const payload          = { id: user._id, role: user.role, vendorId: user.vendorId || null };
    const accessToken      = generateAccessToken(payload);
    const newRefreshToken  = generateRefreshToken(payload);
    user.refreshTokens.push({ token: newRefreshToken, userAgent: meta.userAgent, ip: meta.ip });
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken: newRefreshToken };
  },

  // ── Forgot password ────────────────────────────────────────────────────────
  async forgotPassword(email) {
    const user = await User.findOne({ email, isActive: true });
    if (!user) return; // prevent email enumeration

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken   = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendPasswordResetEmail(user.email, resetToken, resetUrl);
  },

  // ── Reset password ─────────────────────────────────────────────────────────
  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password +passwordResetToken +passwordResetExpires");

    if (!user) throw new AppError("Token is invalid or has expired", 400);

    user.password             = newPassword;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens        = [];
    await user.save();
  },
};

module.exports = authService;
