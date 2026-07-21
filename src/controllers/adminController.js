const User    = require("../models/User");
const Vendor  = require("../models/Vendor");
const asyncHandler = require("../utils/asyncHandler");
const AppError     = require("../utils/AppError");
const { successResponse, paginatedResponse } = require("../utils/apiResponse");
const { sendEmail } = require("../utils/emailUtils");

const SAFE_SELECT = "-password -refreshTokens -passwordResetToken -passwordResetExpires -invitationToken -invitationExpires";

// ── Get All Users ──────────────────────────────────────────────────────────
// ?vendorId= → filter users belonging to a specific vendor
// ?isApproved=false → filter pending vendor users awaiting approval
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role, vendorId, isApproved } = req.query;

  const filter = {};
  if (role)     filter.role     = role;
  if (vendorId) filter.vendorId = vendorId;
  if (isApproved !== undefined) filter.isApproved = isApproved === "true";
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName:  { $regex: search, $options: "i" } },
      { email:     { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter)
      .select(SAFE_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(+limit)
      .populate("vendorId", "name email"),
    User.countDocuments(filter),
  ]);

  paginatedResponse(res, "Users fetched", users, page, limit, total);
});

// ── Get Pending Vendor Users (shortcut) ───────────────────────────────────
exports.getPendingVendorUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const filter = { isApproved: false, vendorId: { $ne: null } };
  const skip   = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter)
      .select(SAFE_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(+limit)
      .populate("vendorId", "name email"),
    User.countDocuments(filter),
  ]);
  paginatedResponse(res, "Pending vendor users fetched", users, page, limit, total);
});

// ── Get User by ID ─────────────────────────────────────────────────────────
exports.getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select(SAFE_SELECT)
    .populate("vendorId", "name email");
  if (!user) throw new AppError("User not found", 404);
  successResponse(res, 200, "User fetched", { user });
});

// ── Approve Vendor User ───────────────────────────────────────────────────
exports.approveVendorUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate("vendorId", "name email");
  if (!user)           throw new AppError("User not found", 404);
  if (!user.vendorId)  throw new AppError("User is not a vendor user", 400);
  if (user.isApproved) throw new AppError("User is already approved", 400);

  user.isApproved = true;
  user.approvedBy = req.user._id;
  user.approvedAt = new Date();
  await user.save({ validateBeforeSave: false });

  // Email the user
  await sendEmail({
    to:      user.email,
    subject: `Your Sports Hub account has been approved — ${user.vendorId.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#1B2A4A;">Account Approved!</h2>
        <p>Hi ${user.firstName},</p>
        <p>Your Sports Hub account linked to <strong>${user.vendorId.name}</strong> has been approved.</p>
        <p>You can now log in and access your vendor-specific product catalogue.</p>
        <a href="${process.env.CLIENT_URL}/login"
           style="display:inline-block;padding:12px 28px;background:#2563EB;color:#fff;text-decoration:none;border-radius:4px;margin:20px 0;">
          Log In Now
        </a>
      </div>`,
  }).catch(() => {});

  successResponse(res, 200, "Vendor user approved", { user: user.toSafeObject() });
});

// ── Reject Vendor User ────────────────────────────────────────────────────
exports.rejectVendorUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate("vendorId", "name");
  if (!user)          throw new AppError("User not found", 404);
  if (!user.vendorId) throw new AppError("User is not a vendor user", 400);

  const reason = req.body.reason || "Your registration was not approved.";

  // Notify the user
  await sendEmail({
    to:      user.email,
    subject: "Sports Hub — Account Registration Update",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#1B2A4A;">Account Registration Update</h2>
        <p>Hi ${user.firstName},</p>
        <p>Unfortunately your account registration for <strong>${user.vendorId.name}</strong> was not approved.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>If you believe this is a mistake, please contact Sports Hub support.</p>
      </div>`,
  }).catch(() => {});

  // Delete the user account
  await User.findByIdAndDelete(req.params.id);
  successResponse(res, 200, "Vendor user rejected and removed");
});

// ── Toggle User Active Status ─────────────────────────────────────────────
exports.toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError("Cannot deactivate your own account", 400);
  }
  user.isActive = !user.isActive;
  await user.save({ validateBeforeSave: false });
  successResponse(res, 200, `User ${user.isActive ? "activated" : "deactivated"}`, {
    userId: user._id, isActive: user.isActive,
  });
});
