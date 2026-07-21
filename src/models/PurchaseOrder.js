const mongoose = require("mongoose");
const { PO_STATUS } = require("../utils/constants");

const poItemSchema = new mongoose.Schema({
  product:   { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name:      { type: String, required: true },
  sku:       { type: String },
  size:      { type: String },
  quantity:  { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  lineTotal: { type: Number, required: true },
}, { _id: true });

const poTimelineSchema = new mongoose.Schema({
  status:    { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  byName:    { type: String },
  notes:     { type: String },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber:  { type: String, unique: true, index: true },

    companyId:          { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    requestedBy:        { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    purchaseRequestId:  { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest" },
    orderId:            { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

    items:        [poItemSchema],
    subtotal:     { type: Number, required: true },
    shippingFee:  { type: Number, default: 0 },
    discount:     { type: Number, default: 0 },
    vatAmount:    { type: Number, default: 0 },
    vatRate:      { type: Number, default: 0 },
    total:        { type: Number, required: true },

    shippingAddress: {
      fullName:    String,
      phoneNumber: String,
      country:     { type: String, default: "Egypt" },
      city:        String,
      area:        String,
      street:      String,
      building:    String,
      notes:       String,
    },

    status: {
      type:    String,
      enum:    Object.values(PO_STATUS),
      default: PO_STATUS.SUBMITTED,
      index:   true,
    },

    paymentTermsDays: { type: Number, default: 0 },
    dueDate:          { type: Date },
    paidAt:           { type: Date },
    paymentRef:       { type: String },

    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    acknowledgedAt: { type: Date },

    trackingNumber: { type: String },
    carrier:        { type: String },
    shippedAt:      { type: Date },
    deliveredAt:    { type: Date },

    invoiceId:      { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },

    timeline: [poTimelineSchema],

    currency: { type: String, default: "EGP" },
    notes:    { type: String },
  },
  { timestamps: true }
);

purchaseOrderSchema.pre("save", async function () {
  if (!this.poNumber) {
    const d = new Date();
    const y = d.getFullYear();
    const rand = Math.floor(Math.random() * 90000) + 10000;
    this.poNumber = `PO-${y}-${rand}`;
  }
});

purchaseOrderSchema.index({ companyId: 1, status: 1 });
purchaseOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
