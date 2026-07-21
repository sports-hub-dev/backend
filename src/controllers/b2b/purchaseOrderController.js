const PurchaseOrder = require("../../models/PurchaseOrder");
const Invoice       = require("../../models/Invoice");
const Company       = require("../../models/Company");
const AuditLog      = require("../../models/AuditLog");
const asyncHandler  = require("../../utils/asyncHandler");
const AppError      = require("../../utils/AppError");
const { successResponse, paginatedResponse } = require("../../utils/apiResponse");
const { PO_STATUS, PAGINATION } = require("../../utils/constants");

exports.getAllPOs = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, status, companyId } = req.query;
  const filter = {};
  if (status)    filter.status    = status;
  if (companyId) filter.companyId = companyId;
  // Non-admins can only see their own company's POs
  if (req.user.role !== "admin") filter.companyId = req.user.companyId;

  const skip = (page - 1) * limit;
  const [pos, total] = await Promise.all([
    PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit)
      .populate("companyId", "name").populate("requestedBy", "firstName lastName"),
    PurchaseOrder.countDocuments(filter),
  ]);
  paginatedResponse(res, "Purchase orders fetched", pos, page, limit, total);
});

exports.getPOById = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id)
    .populate("companyId").populate("requestedBy", "firstName lastName email");
  if (!po) throw new AppError("Purchase order not found", 404);
  if (req.user.role !== "admin" && po.companyId._id?.toString() !== req.user.companyId?.toString()) {
    throw new AppError("Not authorized", 403);
  }
  successResponse(res, 200, "Purchase order fetched", { purchaseOrder: po });
});

exports.updatePOStatus = asyncHandler(async (req, res) => {
  const { status, notes, trackingNumber, carrier } = req.body;
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new AppError("Purchase order not found", 404);

  const prevStatus = po.status;
  po.status = status;
  po.timeline.push({ status, changedBy: req.user._id, byName: req.user.fullName, notes });

  if (status === PO_STATUS.ACKNOWLEDGED) { po.acknowledgedBy = req.user._id; po.acknowledgedAt = new Date(); }
  if (status === PO_STATUS.FULFILLED)    { po.shippedAt = new Date(); if (trackingNumber) { po.trackingNumber = trackingNumber; po.carrier = carrier; } }
  if (status === PO_STATUS.PAID)         { po.paidAt = new Date(); }

  await po.save();

  await AuditLog.create({
    userId: req.user._id, companyId: po.companyId,
    action: "po.status_changed", resourceType: "PurchaseOrder", resourceId: po._id,
    previousValue: { status: prevStatus }, newValue: { status },
  });

  successResponse(res, 200, "Purchase order status updated", { purchaseOrder: po });
});

exports.generateInvoice = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id).populate("companyId");
  if (!po) throw new AppError("Purchase order not found", 404);
  if (po.invoiceId)  throw new AppError("Invoice already generated for this PO", 400);
  if (![PO_STATUS.FULFILLED, PO_STATUS.INVOICED].includes(po.status)) {
    throw new AppError("Invoice can only be generated for fulfilled POs", 400);
  }

  const company    = po.companyId;
  const vatRate    = req.body.vatRate || 0;
  const vatAmount  = parseFloat((po.subtotal * (vatRate / 100)).toFixed(2));
  const total      = parseFloat((po.subtotal + po.shippingFee - po.discount + vatAmount).toFixed(2));

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (company?.paymentTermsDays || 0));

  const invoice = await Invoice.create({
    companyId:       po.companyId._id || po.companyId,
    purchaseOrderId: po._id,
    items: po.items.map(i => ({
      description: `${i.name}${i.size ? ` (${i.size})` : ""}`,
      quantity:    i.quantity,
      unitPrice:   i.unitPrice,
      lineTotal:   i.lineTotal,
    })),
    subtotal: po.subtotal,
    vatRate, vatAmount,
    total,
    dueDate,
    currency: po.currency || "EGP",
  });

  po.invoiceId = invoice._id;
  po.status    = PO_STATUS.INVOICED;
  po.timeline.push({ status: PO_STATUS.INVOICED, changedBy: req.user._id, byName: req.user.fullName, notes: `Invoice ${invoice.invoiceNumber} generated` });
  await po.save();

  successResponse(res, 201, "Invoice generated", { invoice });
});

exports.markPOPaid = asyncHandler(async (req, res) => {
  const { paymentRef } = req.body;
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new AppError("Purchase order not found", 404);

  po.status     = PO_STATUS.PAID;
  po.paidAt     = new Date();
  po.paymentRef = paymentRef;
  po.timeline.push({ status: PO_STATUS.PAID, changedBy: req.user._id, byName: req.user.fullName, notes: `Payment ref: ${paymentRef}` });
  await po.save();

  // Update company credit used
  await Company.findByIdAndUpdate(po.companyId, { $inc: { creditUsed: -po.total } });

  // Update invoice
  if (po.invoiceId) {
    await Invoice.findByIdAndUpdate(po.invoiceId, { status: "paid", paidAt: new Date(), paymentRef });
  }

  successResponse(res, 200, "Purchase order marked as paid", { purchaseOrder: po });
});
