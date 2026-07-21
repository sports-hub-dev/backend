const mongoose = require("mongoose");
const PurchaseRequest = require("../../models/PurchaseRequest");
const PurchaseOrder   = require("../../models/PurchaseOrder");
const Company         = require("../../models/Company");
const AuditLog        = require("../../models/AuditLog");
const AppError        = require("../../utils/AppError");
const { sendEmail }   = require("../../utils/emailUtils");
const { REQUEST_STATUS, PO_STATUS, COMPANY_ROLES } = require("../../utils/constants");
const companyService  = require("./companyService");

const prService = {

  async createRequest(companyId, userId, items, notes) {
    const company = await Company.findById(companyId);
    if (!company || !company.isActive) throw new AppError("Company not found or inactive", 404);

    // Resolve prices for each item using tier / override logic
    const resolvedItems = await Promise.all(items.map(async (item) => {
      const { price } = await companyService.resolvePrice(item.productId, companyId, item.quantity);
      return {
        product:   item.productId,
        name:      item.name,
        size:      item.size || null,
        quantity:  item.quantity,
        unitPrice: price,
        lineTotal: parseFloat((price * item.quantity).toFixed(2)),
      };
    }));

    const subtotal       = resolvedItems.reduce((s, i) => s + i.lineTotal, 0);
    const shippingFee    = 75; // pulled from settings in production — simplified here
    const estimatedTotal = parseFloat((subtotal + shippingFee).toFixed(2));

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const pr = await PurchaseRequest.create({
      companyId, requestedBy: userId,
      items: resolvedItems, subtotal, shippingFee, estimatedTotal,
      status: REQUEST_STATUS.DRAFT, notes, expiresAt,
      timeline: [{ status: REQUEST_STATUS.DRAFT, byName: "System", notes: "Request created" }],
    });

    return pr;
  },

  async submitRequest(requestId, userId) {
    const pr = await PurchaseRequest.findById(requestId);
    if (!pr) throw new AppError("Purchase request not found", 404);
    if (pr.requestedBy.toString() !== userId.toString()) throw new AppError("Not authorized", 403);
    if (pr.status !== REQUEST_STATUS.DRAFT) throw new AppError("Only draft requests can be submitted", 400);

    // Check auto-approve threshold
    const company = await Company.findById(pr.companyId);
    const autoBelow = company?.approvalRules?.autoApproveBelow || 0;

    if (autoBelow > 0 && pr.estimatedTotal < autoBelow) {
      // Auto-approve
      pr.status     = REQUEST_STATUS.APPROVED;
      pr.approvedAt = new Date();
      pr.timeline.push({ status: REQUEST_STATUS.APPROVED, byName: "System (auto-approved)", notes: `Below auto-approve threshold of ${autoBelow} EGP` });
      await pr.save();
      return pr;
    }

    pr.status = REQUEST_STATUS.PENDING_APPROVAL;
    pr.timeline.push({ status: REQUEST_STATUS.PENDING_APPROVAL, changedBy: userId, notes: "Submitted for approval" });
    await pr.save();

    // Notify managers/owners
    await this._notifyApprovers(pr, company);
    return pr;
  },

  async approveRequest(requestId, approverId, approverName, notes) {
    const pr = await PurchaseRequest.findById(requestId).populate("companyId");
    if (!pr) throw new AppError("Purchase request not found", 404);
    if (pr.status !== REQUEST_STATUS.PENDING_APPROVAL) throw new AppError("Request is not pending approval", 400);

    const company = pr.companyId;
    const stage2Threshold = company?.approvalRules?.stage2Threshold;

    // Check if two-stage approval is needed
    if (stage2Threshold && pr.estimatedTotal >= stage2Threshold && pr.approvalStage === 1) {
      pr.approvalStage   = 2;
      pr.approvedBy      = approverId;
      pr.approvedAt      = new Date();
      pr.timeline.push({ status: "stage1_approved", changedBy: approverId, byName: approverName, notes: "Stage 1 approved — awaiting owner confirmation" });
      await pr.save();
      return pr;
    }

    pr.status     = REQUEST_STATUS.APPROVED;
    pr.approvedBy = pr.approvedBy || approverId;
    pr.approvedAt = pr.approvedAt || new Date();
    if (pr.approvalStage === 2) {
      pr.stage2ApprovedBy = approverId;
      pr.stage2ApprovedAt = new Date();
    }
    pr.timeline.push({ status: REQUEST_STATUS.APPROVED, changedBy: approverId, byName: approverName, notes: notes || "Approved" });
    await pr.save();

    await AuditLog.create({
      userId: approverId, companyId: pr.companyId._id || pr.companyId,
      action: "order.approved", resourceType: "PurchaseRequest", resourceId: pr._id,
    });

    return pr;
  },

  async rejectRequest(requestId, rejecterId, rejectorName, reason) {
    const pr = await PurchaseRequest.findById(requestId);
    if (!pr) throw new AppError("Purchase request not found", 404);
    if (pr.status !== REQUEST_STATUS.PENDING_APPROVAL) throw new AppError("Request is not pending approval", 400);

    pr.status          = REQUEST_STATUS.REJECTED;
    pr.rejectedBy      = rejecterId;
    pr.rejectedAt      = new Date();
    pr.rejectionReason = reason;
    pr.timeline.push({ status: REQUEST_STATUS.REJECTED, changedBy: rejecterId, byName: rejectorName, notes: reason });
    await pr.save();

    await AuditLog.create({
      userId: rejecterId, companyId: pr.companyId,
      action: "order.rejected", resourceType: "PurchaseRequest", resourceId: pr._id,
    });

    return pr;
  },

  async convertToPO(requestId, adminId, adminName, shippingAddress) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const pr = await PurchaseRequest.findById(requestId).session(session);
      if (!pr) throw new AppError("Purchase request not found", 404);
      if (pr.status !== REQUEST_STATUS.APPROVED) throw new AppError("Only approved requests can be converted to PO", 400);
      if (pr.convertedPOId) throw new AppError("This request has already been converted to a PO", 400);

      const company = await Company.findById(pr.companyId).session(session);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (company?.paymentTermsDays || 0));

      const [po] = await PurchaseOrder.create([{
        companyId:          pr.companyId,
        requestedBy:        pr.requestedBy,
        purchaseRequestId:  pr._id,
        items:              pr.items,
        subtotal:           pr.subtotal,
        shippingFee:        pr.shippingFee,
        total:              pr.estimatedTotal,
        shippingAddress,
        status:             PO_STATUS.SUBMITTED,
        paymentTermsDays:   company?.paymentTermsDays || 0,
        dueDate,
        timeline: [{ status: PO_STATUS.SUBMITTED, changedBy: adminId, byName: adminName, notes: "PO created from approved request" }],
      }], { session });

      pr.convertedPOId = po._id;
      pr.timeline.push({ status: "converted", changedBy: adminId, byName: adminName, notes: `Converted to PO ${po.poNumber}` });
      await pr.save({ session });

      await session.commitTransaction();
      session.endSession();
      return po;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  },

  async _notifyApprovers(pr, company) {
    try {
      const User = require("../../models/User");
      const approvers = await User.find({
        companyId: pr.companyId,
        companyRole: { $in: [COMPANY_ROLES.MANAGER, COMPANY_ROLES.OWNER] },
        isActive: true,
      }).select("email firstName");

      for (const approver of approvers) {
        await sendEmail({
          to: approver.email,
          subject: `Action Required: Purchase Request ${pr.requestNumber} awaiting your approval`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;">
              <h2 style="color:#1B2A4A;">Purchase Request Pending Approval</h2>
              <p>Hi ${approver.firstName},</p>
              <p>A new purchase request requires your approval:</p>
              <table style="border-collapse:collapse;width:100%;">
                <tr><td style="padding:8px;border:1px solid #CBD5E1;"><strong>Request #</strong></td><td style="padding:8px;border:1px solid #CBD5E1;">${pr.requestNumber}</td></tr>
                <tr><td style="padding:8px;border:1px solid #CBD5E1;"><strong>Items</strong></td><td style="padding:8px;border:1px solid #CBD5E1;">${pr.items.length}</td></tr>
                <tr><td style="padding:8px;border:1px solid #CBD5E1;"><strong>Total</strong></td><td style="padding:8px;border:1px solid #CBD5E1;">${pr.estimatedTotal} EGP</td></tr>
              </table>
              <a href="${process.env.CLIENT_URL}/b2b/requests/${pr._id}"
                 style="display:inline-block;padding:12px 28px;background:#2563EB;color:#fff;text-decoration:none;border-radius:4px;margin:20px 0;">
                Review Request
              </a>
            </div>`,
        });
      }
    } catch (e) {
      // Non-fatal — log but don't throw
      const logger = require("../../utils/logger");
      logger.warn("Failed to notify approvers: " + e.message);
    }
  },
};

module.exports = prService;
