const mongoose = require("mongoose");
const { PRODUCT_SIZES } = require("../utils/constants");

const variantSchema = new mongoose.Schema(
  {
    size:     { type: String, required: true, enum: [...PRODUCT_SIZES], trim: true },
    stock:    { type: Number, required: true, min: 0, default: 0 },
    sku:      { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    attributes: {
      color:    { type: String, trim: true },
      material: { type: String, trim: true },
      gender:   { type: String, enum: ["men", "women", "unisex", null] },
    },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    price:       { type: Number, required: true, min: 0 },
    category:    { type: String, required: true, trim: true, index: true },

    // Images
    mainImage:        { type: String, required: true },
    additionalImages: [{ type: String }],

    // Variant system
    hasSizeVariants: { type: Boolean, default: false },
    variants:        [variantSchema],
    stock:           { type: Number, min: 0, default: 0 },

    // ── Visibility ────────────────────────────────────────────────────────
    // isPublic = true  → visible to everyone (logged in or not)
    // isPublic = false → visible only to approved users of the linked vendor
    isPublic:  { type: Boolean, default: true, index: true },

    // When isPublic = false, only users with this vendorId can see it
    vendorId:  { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", index: true, default: null },

    // Status
    isActive:  { type: Boolean, default: true, index: true },

    // Soft delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Future multi-country
    countryAvailability: [{ type: String, default: ["EG"] }],
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.virtual("totalStock").get(function () {
  if (!this.hasSizeVariants) return this.stock;
  return this.variants.reduce((sum, v) => sum + (v.isActive ? v.stock : 0), 0);
});

productSchema.virtual("isAvailable").get(function () {
  if (!this.isActive || this.isDeleted) return false;
  return this.totalStock > 0;
});

productSchema.index({ name: "text", description: "text" });
productSchema.index({ isDeleted: 1, isActive: 1 });
productSchema.index({ category: 1, isActive: 1, isDeleted: 1 });
productSchema.index({ isPublic: 1, vendorId: 1, isActive: 1, isDeleted: 1 });

module.exports = mongoose.model("Product", productSchema);
