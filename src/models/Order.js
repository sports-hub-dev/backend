const mongoose = require("mongoose");
const { ORDER_STATUS } = require("../utils/constants");

const orderItemSchema = new mongoose.Schema(
  {
    product:   { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name:      { type: String, required: true },
    mainImage: { type: String },
    size:      { type: String },
    quantity:  { type: Number, required: true, min: 1 },
    price:     { type: Number, required: true },
  },
  { _id: true }
);

const orderTimelineSchema = new mongoose.Schema(
  {
    previousStatus: { type: String },
    newStatus:      { type: String, required: true, enum: Object.values(ORDER_STATUS) },
    changedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedByName:  { type: String },
    notes:          { type: String },
    timestamp:      { type: Date, default: Date.now },
  },
  { _id: true }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName:    { type: String, required: true },
    phoneNumber: { type: String, required: true },
    country:     { type: String, default: "Egypt" },
    city:        { type: String, required: true },
    area:        { type: String, required: true },
    street:      { type: String, required: true },
    building:    { type: String },
    floor:       { type: String },
    apartment:   { type: String },
    notes:       { type: String },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, index: true },

    // Customer
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    isGuest: { type: Boolean, default: false },
    customerInfo: {
      name:  { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      phone: { type: String, required: true },
    },

    shippingAddress: { type: shippingAddressSchema, required: true },
    items:           [orderItemSchema],

    // Pricing
    subtotal:    { type: Number, required: true },
    shippingFee: { type: Number, required: true, default: 0 },
    discount:    { type: Number, default: 0 },
    total:       { type: Number, required: true },

    // Promo
    promoCode:     { type: String },
    promoDiscount: { type: Number, default: 0 },

    // ── Payment ────────────────────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ["aps", "unpaid"],
      default: "unpaid",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    paidAt: { type: Date },

    // Amazon Payment Services — their own transaction reference ("FORT ID")
    apsFortId: { type: String, index: true, sparse: true },

    // Generic payment reference (populated by the gateway)
    paymentReference: { type: String },

    // Order status
    status: {
      type:    String,
      enum:    Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index:   true,
    },

    timeline: [orderTimelineSchema],

    // Vendor scoping
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", index: true, default: null },

    currency: { type: String, default: "EGP" },
    country:  { type: String, default: "EG" },
  },
  { timestamps: true }
);

// Auto-generate order number — Mongoose 7+: no next()
orderSchema.pre("save", async function () {
  if (!this.orderNumber) {
    const date = new Date();
    const y    = date.getFullYear().toString().slice(-2);
    const m    = String(date.getMonth() + 1).padStart(2, "0");
    const d    = String(date.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 90000) + 10000;
    this.orderNumber = `SH${y}${m}${d}-${rand}`;
  }
});

orderSchema.index({ createdAt: -1 });
orderSchema.index({ "customerInfo.email": 1 });
orderSchema.index({ vendorId: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, paymentMethod: 1 });

module.exports = mongoose.model("Order", orderSchema);