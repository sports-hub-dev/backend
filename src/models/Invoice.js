const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true, index: true },

    companyId:       { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
    orderId:         { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

    items: [{
      description: String,
      quantity:    Number,
      unitPrice:   Number,
      lineTotal:   Number,
    }],

    subtotal:   { type: Number, required: true },
    vatRate:    { type: Number, default: 0 },
    vatAmount:  { type: Number, default: 0 },
    total:      { type: Number, required: true },

    currency:   { type: String, default: "EGP" },

    status:   { type: String, enum: ["unpaid", "paid", "overdue", "cancelled"], default: "unpaid", index: true },
    issuedAt: { type: Date, default: Date.now },
    dueDate:  { type: Date, required: true },
    paidAt:   { type: Date },
    paymentRef: { type: String },

    pdfUrl:   { type: String },
    notes:    { type: String },
  },
  { timestamps: true }
);

invoiceSchema.pre("save", async function () {
  if (!this.invoiceNumber) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const rand = Math.floor(Math.random() * 90000) + 10000;
    this.invoiceNumber = `INV-${y}${m}-${rand}`;
  }
});

invoiceSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
