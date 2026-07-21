const Company        = require("../../models/Company");
const User           = require("../../models/User");
const CompanyPrice   = require("../../models/CompanyPrice");
const PricingTier    = require("../../models/PricingTier");
const AuditLog       = require("../../models/AuditLog");
const companyService = require("../../services/b2b/companyService");
const asyncHandler   = require("../../utils/asyncHandler");
const AppError       = require("../../utils/AppError");
const { successResponse, paginatedResponse } = require("../../utils/apiResponse");
const { PAGINATION } = require("../../utils/constants");

// ── Admin: Create Company ──────────────────────────────────────────────────
exports.createCompany = asyncHandler(async (req, res) => {
  const company = await companyService.createCompany(req.body, req.user._id);
  successResponse(res, 201, "Company created", { company });
});

// ── Admin: Approve Company ─────────────────────────────────────────────────
exports.approveCompany = asyncHandler(async (req, res) => {
  const company = await companyService.approveCompany(req.params.id, req.user._id);
  successResponse(res, 200, "Company approved", { company });
});

// ── Admin: Suspend Company ─────────────────────────────────────────────────
exports.suspendCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new AppError("Company not found", 404);
  company.status   = "suspended";
  company.isActive = false;
  await company.save();
  successResponse(res, 200, "Company suspended", { company });
});

// ── Admin / Owner: Get All Companies ──────────────────────────────────────
exports.getAllCompanies = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, status, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.$text = { $search: search };

  const skip = (page - 1) * limit;
  const [companies, total] = await Promise.all([
    Company.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit).populate("accountManagerId", "firstName lastName email"),
    Company.countDocuments(filter),
  ]);
  paginatedResponse(res, "Companies fetched", companies, page, limit, total);
});

// ── Get Company by ID ──────────────────────────────────────────────────────
exports.getCompanyById = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id).populate("accountManagerId", "firstName lastName email");
  if (!company) throw new AppError("Company not found", 404);
  successResponse(res, 200, "Company fetched", { company });
});

// ── Owner/Admin: Update Company ────────────────────────────────────────────
exports.updateCompany = asyncHandler(async (req, res) => {
  const allowed = ["name","tradeName","phone","billingAddress","shippingAddresses","approvalRules","notes"];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const company = await Company.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!company) throw new AppError("Company not found", 404);

  await AuditLog.create({ userId: req.user._id, companyId: company._id, action: "company.updated", resourceType: "Company", resourceId: company._id, newValue: updates });
  successResponse(res, 200, "Company updated", { company });
});

// ── Invite Employee ────────────────────────────────────────────────────────
exports.inviteEmployee = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const result = await companyService.inviteEmployee(companyId, req.user._id, req.body);
  successResponse(res, 200, "Invitation sent", result);
});

// ── Accept Invitation ──────────────────────────────────────────────────────
exports.acceptInvitation = asyncHandler(async (req, res) => {
  const user = await companyService.acceptInvitation(req.params.token, req.body.password);
  successResponse(res, 200, "Invitation accepted. You can now log in.", { user });
});

// ── Get Company Team Members ───────────────────────────────────────────────
exports.getTeamMembers = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const members = await User.find({ companyId, isActive: true }).select("-password -refreshTokens -passwordResetToken");
  successResponse(res, 200, "Team members fetched", { members });
});

// ── Owner: Update Member Role ──────────────────────────────────────────────
exports.updateMemberRole = asyncHandler(async (req, res) => {
  const { companyRole } = req.body;
  const member = await User.findOne({ _id: req.params.userId, companyId: req.user.companyId });
  if (!member) throw new AppError("Team member not found", 404);
  member.companyRole = companyRole;
  await member.save({ validateBeforeSave: false });
  successResponse(res, 200, "Member role updated", { member: member.toSafeObject() });
});

// ── Owner: Revoke Employee Access ──────────────────────────────────────────
exports.revokeEmployee = asyncHandler(async (req, res) => {
  const member = await User.findOne({ _id: req.params.userId, companyId: req.user.companyId });
  if (!member) throw new AppError("Team member not found", 404);
  member.isActive      = false;
  member.companyId     = undefined;
  member.companyRole   = null;
  member.refreshTokens = [];
  await member.save({ validateBeforeSave: false });

  await AuditLog.create({ userId: req.user._id, companyId: req.user.companyId, action: "user.revoked", resourceType: "User", resourceId: member._id });
  successResponse(res, 200, "Employee access revoked");
});

// ── Resolve Price for Company ──────────────────────────────────────────────
exports.resolvePrice = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId || req.params.companyId;
  const { productId, quantity } = req.query;
  const result = await companyService.resolvePrice(productId, companyId, +quantity || 1);
  successResponse(res, 200, "Price resolved", result);
});

// ── Admin: Set Company-Specific Price Override ─────────────────────────────
exports.setCompanyPrice = asyncHandler(async (req, res) => {
  const { productId, customPrice, validFrom, validTo, notes } = req.body;
  const companyId = req.params.companyId;

  const override = await CompanyPrice.findOneAndUpdate(
    { companyId, productId },
    { customPrice, validFrom, validTo, notes, createdBy: req.user._id },
    { upsert: true, new: true, runValidators: true }
  );

  await AuditLog.create({ userId: req.user._id, companyId, action: "price.updated", resourceType: "CompanyPrice", resourceId: override._id, newValue: { customPrice } });
  successResponse(res, 200, "Price override set", { override });
});

// ── Admin: Manage Pricing Tiers ────────────────────────────────────────────
exports.getPricingTiers = asyncHandler(async (req, res) => {
  const tiers = await PricingTier.find().sort({ discountPercentage: 1 });
  successResponse(res, 200, "Pricing tiers fetched", { tiers });
});

exports.upsertPricingTier = asyncHandler(async (req, res) => {
  const { name, label, discountPercentage, paymentTermsDays, minMonthlySpend, description } = req.body;
  const tier = await PricingTier.findOneAndUpdate(
    { name },
    { label, discountPercentage, paymentTermsDays, minMonthlySpend, description },
    { upsert: true, new: true, runValidators: true }
  );
  successResponse(res, 200, "Pricing tier saved", { tier });
});

exports.assignPricingTier = asyncHandler(async (req, res) => {
  const company = await Company.findByIdAndUpdate(
    req.params.companyId,
    { pricingTier: req.body.pricingTier },
    { new: true }
  );
  if (!company) throw new AppError("Company not found", 404);
  await AuditLog.create({ userId: req.user._id, companyId: company._id, action: "company.updated", resourceType: "Company", resourceId: company._id, newValue: { pricingTier: req.body.pricingTier } });
  successResponse(res, 200, "Pricing tier assigned", { company });
});

// ── Audit Logs ─────────────────────────────────────────────────────────────
exports.getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, companyId, action } = req.query;
  const filter = {};
  if (companyId) filter.companyId = companyId;
  if (action)    filter.action = action;

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit).populate("userId", "firstName lastName"),
    AuditLog.countDocuments(filter),
  ]);
  paginatedResponse(res, "Audit logs fetched", logs, page, limit, total);
});
