const mongoose = require("mongoose");
const { REQUEST_STATUS } = require("../utils/constants");

const requestItemSchema = new mongoose.Schema({
  product:   { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name:      { type: String, required: true },
  size:      { type: String },
  quantity:  { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  lineTotal: { type: Number, required: true },
}, { _id: true });

const timelineEntrySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  byName:    { type: String },
  notes:     { type: String },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, unique: true, index: true },

    companyId:   { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true, index: true },

    items:          [requestItemSchema],
    subtotal:       { type: Number, required: true },
    estimatedTotal: { type: Number, required: true },  // incl. estimated shipping
    shippingFee:    { type: Number, default: 0 },

    status: {
      type:    String,
      enum:    Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.DRAFT,
      index:   true,
    },

    // Approval
    approvalStage:   { type: Number, default: 1 },       // 1 = needs manager, 2 = needs owner
    approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt:      { type: Date },
    stage2ApprovedBy:{ type: mongoose.Schema.Types.ObjectId, ref: "User" },
    stage2ApprovedAt:{ type: Date },

    rejectedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt:      { type: Date },
    rejectionReason: { type: String },

    notes:           { type: String },
    expiresAt:       { type: Date },

    // Set when approved → converts to real PO/Order
    convertedPOId:   { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder" },

    timeline: [timelineEntrySchema],

    currency: { type: String, default: "EGP" },
  },
  { timestamps: true }
);

// Auto-generate request number
purchaseRequestSchema.pre("save", async function () {
  if (!this.requestNumber) {
    const d = new Date();
    const y = d.getFullYear().toString().slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const rand = Math.floor(Math.random() * 90000) + 10000;
    this.requestNumber = `REQ${y}${m}-${rand}`;
  }
});

purchaseRequestSchema.index({ companyId: 1, status: 1 });
purchaseRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PurchaseRequest", purchaseRequestSchema);
