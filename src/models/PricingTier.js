const mongoose = require("mongoose");
const { PRICING_TIERS } = require("../utils/constants");

const pricingTierSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      enum:     Object.values(PRICING_TIERS),
      required: true,
      unique:   true,
    },
    label:             { type: String, required: true },   // e.g. "Gold Tier"
    discountPercentage:{ type: Number, required: true, min: 0, max: 100, default: 0 },
    paymentTermsDays:  { type: Number, enum: [0, 15, 30, 60, 90], default: 0 },
    minMonthlySpend:   { type: Number, default: 0 },        // EGP threshold
    description:       { type: String },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PricingTier", pricingTierSchema);
