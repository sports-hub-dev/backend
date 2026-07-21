const PurchaseRequest = require("../../models/PurchaseRequest");
const prService       = require("../../services/b2b/purchaseRequestService");
const asyncHandler    = require("../../utils/asyncHandler");
const AppError        = require("../../utils/AppError");
const { successResponse, paginatedResponse } = require("../../utils/apiResponse");
const { PAGINATION, COMPANY_ROLES } = require("../../utils/constants");

exports.createRequest = asyncHandler(async (req, res) => {
  const pr = await prService.createRequest(
    req.user.companyId, req.user._id, req.body.items, req.body.notes
  );
  successResponse(res, 201, "Purchase request created", { request: pr });
});

exports.submitRequest = asyncHandler(async (req, res) => {
  const pr = await prService.submitRequest(req.params.id, req.user._id);
  successResponse(res, 200, "Purchase request submitted for approval", { request: pr });
});

exports.approveRequest = asyncHandler(async (req, res) => {
  const pr = await prService.approveRequest(
    req.params.id, req.user._id, req.user.fullName, req.body.notes
  );
  successResponse(res, 200, "Purchase request approved", { request: pr });
});

exports.rejectRequest = asyncHandler(async (req, res) => {
  if (!req.body.reason) throw new AppError("Rejection reason is required", 400);
  const pr = await prService.rejectRequest(
    req.params.id, req.user._id, req.user.fullName, req.body.reason
  );
  successResponse(res, 200, "Purchase request rejected", { request: pr });
});

exports.convertToPO = asyncHandler(async (req, res) => {
  const po = await prService.convertToPO(
    req.params.id, req.user._id, req.user.fullName, req.body.shippingAddress
  );
  successResponse(res, 201, "Purchase order created", { purchaseOrder: po });
});

exports.cancelRequest = asyncHandler(async (req, res) => {
  const pr = await PurchaseRequest.findById(req.params.id);
  if (!pr) throw new AppError("Purchase request not found", 404);
  if (!["draft","pending_approval"].includes(pr.status)) throw new AppError("Cannot cancel a request in this state", 400);
  if (pr.requestedBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new AppError("Not authorized", 403);
  }
  pr.status = "cancelled";
  pr.timeline.push({ status: "cancelled", changedBy: req.user._id, byName: req.user.fullName, notes: req.body.notes || "Cancelled by user" });
  await pr.save();
  successResponse(res, 200, "Purchase request cancelled", { request: pr });
});

exports.getMyRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, status } = req.query;
  const filter = { requestedBy: req.user._id };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [requests, total] = await Promise.all([
    PurchaseRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit),
    PurchaseRequest.countDocuments(filter),
  ]);
  paginatedResponse(res, "Requests fetched", requests, page, limit, total);
});

exports.getCompanyRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, status } = req.query;
  const companyId = req.user.companyId || req.params.companyId;
  const filter = { companyId };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [requests, total] = await Promise.all([
    PurchaseRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit).populate("requestedBy", "firstName lastName email"),
    PurchaseRequest.countDocuments(filter),
  ]);
  paginatedResponse(res, "Company requests fetched", requests, page, limit, total);
});

exports.getRequestById = asyncHandler(async (req, res) => {
  const pr = await PurchaseRequest.findById(req.params.id).populate("requestedBy", "firstName lastName email");
  if (!pr) throw new AppError("Purchase request not found", 404);
  // Ensure user belongs to same company or is admin
  if (req.user.role !== "admin" && pr.companyId.toString() !== req.user.companyId?.toString()) {
    throw new AppError("Not authorized", 403);
  }
  successResponse(res, 200, "Request fetched", { request: pr });
});
