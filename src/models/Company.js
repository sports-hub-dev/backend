const mongoose = require("mongoose");
const { COMPANY_STATUS, PRICING_TIERS } = require("../utils/constants");

const addressSchema = new mongoose.Schema({
  fullName:    { type: String, trim: true },
  phoneNumber: { type: String, trim: true },
  country:     { type: String, default: "Egypt" },
  city:        { type: String, required: true, trim: true },
  area:        { type: String, trim: true },
  street:      { type: String, required: true, trim: true },
  building:    { type: String, trim: true },
  notes:       { type: String, trim: true },
  isDefault:   { type: Boolean, default: false },
}, { _id: true });

const approvalRuleSchema = new mongoose.Schema({
  maxAmount:      { type: Number, default: null },   // null = unlimited
  requiresStage1: { type: Boolean, default: true },  // manager
  requiresStage2: { type: Boolean, default: false }, // owner
  notes:          { type: String },
}, { _id: false });

const companySchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true, index: true },
    tradeName:    { type: String, trim: true },
    taxId:        { type: String, trim: true, unique: true, sparse: true },
    email:        { type: String, required: true, lowercase: true, trim: true },
    phone:        { type: String, trim: true },

    billingAddress:   { type: addressSchema },
    shippingAddresses:{ type: [addressSchema], default: [] },

    pricingTier: {
      type:    String,
      enum:    Object.values(PRICING_TIERS),
      default: PRICING_TIERS.STANDARD,
    },

    // Credit / payment terms
    creditLimit:      { type: Number, default: 0 },
    creditUsed:       { type: Number, default: 0 },
    paymentTermsDays: { type: Number, enum: [0, 15, 30, 60, 90], default: 0 },

    // Account manager at Sports Hub
    accountManagerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Approval workflow config
    approvalRules: {
      autoApproveBelow: { type: Number, default: 0 },   // 0 = never auto-approve
      stage1Threshold:  { type: Number, default: 0 },    // manager approval above this
      stage2Threshold:  { type: Number, default: null },  // owner approval above this
    },

    status:   { type: String, enum: Object.values(COMPANY_STATUS), default: COMPANY_STATUS.PENDING, index: true },
    isActive: { type: Boolean, default: false },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },

    // Future multi-country
    country:    { type: String, default: "EG" },
    currency:   { type: String, default: "EGP" },

    notes: { type: String },
  },
  { timestamps: true }
);

companySchema.virtual("availableCredit").get(function () {
  return Math.max(0, this.creditLimit - this.creditUsed);
});

companySchema.index({ name: "text" });

module.exports = mongoose.model("Company", companySchema);
