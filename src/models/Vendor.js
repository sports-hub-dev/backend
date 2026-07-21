const mongoose = require("mongoose");
const { VENDOR_STATUS } = require("../utils/constants");

const vendorSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true, index: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:         { type: String, trim: true },
    description:   { type: String, trim: true },

    // Owner user account
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    address: {
      city:    { type: String, trim: true },
      area:    { type: String, trim: true },
      street:  { type: String, trim: true },
      country: { type: String, default: "Egypt" },
    },

    commissionRate: { type: Number, default: 10, min: 0, max: 100 }, // percentage

    bankDetails: {
      bankName:      { type: String },
      accountName:   { type: String },
      accountNumber: { type: String },
      iban:          { type: String },
    },

    status:     { type: String, enum: Object.values(VENDOR_STATUS), default: VENDOR_STATUS.PENDING, index: true },
    isActive:   { type: Boolean, default: false },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String },

    // Document uploads (trade license, tax card, etc.)
    documents: [{
      type:       { type: String },
      fileUrl:    { type: String },
      uploadedAt: { type: Date, default: Date.now },
      verified:   { type: Boolean, default: false },
    }],

    totalSales:   { type: Number, default: 0 },
    totalPayouts: { type: Number, default: 0 },

    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
