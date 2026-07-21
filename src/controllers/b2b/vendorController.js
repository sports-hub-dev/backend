const Vendor    = require("../../models/Vendor");
const User      = require("../../models/User");
const Product   = require("../../models/Product");
const AuditLog  = require("../../models/AuditLog");
const asyncHandler  = require("../../utils/asyncHandler");
const AppError      = require("../../utils/AppError");
const { successResponse, paginatedResponse } = require("../../utils/apiResponse");
const { PAGINATION, VENDOR_STATUS } = require("../../utils/constants");
const { sendEmail }  = require("../../utils/emailUtils");

// ── Admin: Create Vendor ───────────────────────────────────────────────────
exports.createVendor = asyncHandler(async (req, res) => {
  const existing = await Vendor.findOne({ email: req.body.email });
  if (existing) throw new AppError("A vendor with this email already exists", 409);

  const vendor = await Vendor.create({
    ...req.body,
    status:   VENDOR_STATUS.APPROVED,
    isActive: true,
    approvedBy: req.user._id,
    approvedAt: new Date(),
  });

  await AuditLog.create({
    userId: req.user._id, action: "vendor.created",
    resourceType: "Vendor", resourceId: vendor._id,
    newValue: { name: vendor.name, email: vendor.email },
  });

  successResponse(res, 201, "Vendor created", { vendor });
});

// ── Admin: Get All Vendors ────────────────────────────────────────────────
exports.getAllVendors = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, status, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.$or = [
    { name:  { $regex: search, $options: "i" } },
    { email: { $regex: search, $options: "i" } },
  ];
  const skip = (page - 1) * limit;
  const [vendors, total] = await Promise.all([
    Vendor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit),
    Vendor.countDocuments(filter),
  ]);
  paginatedResponse(res, "Vendors fetched", vendors, page, limit, total);
});

// ── Get Vendor by ID ──────────────────────────────────────────────────────
exports.getVendorById = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new AppError("Vendor not found", 404);
  successResponse(res, 200, "Vendor fetched", { vendor });
});

// ── Admin: Update Vendor ──────────────────────────────────────────────────
exports.updateVendor = asyncHandler(async (req, res) => {
  const allowed = ["name", "phone", "description", "address", "commissionRate", "notes"];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!vendor) throw new AppError("Vendor not found", 404);
  successResponse(res, 200, "Vendor updated", { vendor });
});

// ── Admin: Suspend / Reactivate Vendor ────────────────────────────────────
exports.toggleVendorStatus = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new AppError("Vendor not found", 404);
  vendor.isActive = !vendor.isActive;
  vendor.status   = vendor.isActive ? VENDOR_STATUS.APPROVED : VENDOR_STATUS.SUSPENDED;
  await vendor.save();

  // Also deactivate all vendor users if suspending
  if (!vendor.isActive) {
    await User.updateMany({ vendorId: vendor._id }, { isActive: false });
  }

  await AuditLog.create({
    userId: req.user._id, action: vendor.isActive ? "vendor.activated" : "vendor.suspended",
    resourceType: "Vendor", resourceId: vendor._id,
  });

  successResponse(res, 200, `Vendor ${vendor.isActive ? "activated" : "suspended"}`, { vendor });
});

// ── Get Vendor's Products ─────────────────────────────────────────────────
exports.getVendorProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;
  const skip = (page - 1) * limit;
  const filter = { vendorId: req.params.id, isDeleted: false };
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit),
    Product.countDocuments(filter),
  ]);
  paginatedResponse(res, "Vendor products fetched", products, page, limit, total);
});

// ── Get Vendor's Users ────────────────────────────────────────────────────
exports.getVendorUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, isApproved } = req.query;
  const filter = { vendorId: req.params.id };
  if (isApproved !== undefined) filter.isApproved = isApproved === "true";
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password -refreshTokens -passwordResetToken -passwordResetExpires")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(+limit),
    User.countDocuments(filter),
  ]);
  paginatedResponse(res, "Vendor users fetched", users, page, limit, total);
});

// ── Public: Get Active Vendors List ──────────────────────────────────────
// Frontend uses this to populate the vendor selector on the register page
exports.getActiveVendors = asyncHandler(async (req, res) => {
  const vendors = await Vendor.find({ isActive: true, status: VENDOR_STATUS.APPROVED })
    .select("name description")
    .sort({ name: 1 });
  successResponse(res, 200, "Active vendors fetched", { vendors });
});
