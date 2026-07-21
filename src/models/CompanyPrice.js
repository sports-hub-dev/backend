const mongoose = require("mongoose");

// Company-specific product price overrides (highest priority in price resolution)
const companyPriceSchema = new mongoose.Schema(
  {
    companyId:   { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    customPrice: { type: Number, required: true, min: 0 },
    validFrom:   { type: Date, default: Date.now },
    validTo:     { type: Date, default: null },  // null = no expiry
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes:       { type: String },
  },
  { timestamps: true }
);

companyPriceSchema.index({ companyId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model("CompanyPrice", companyPriceSchema);
