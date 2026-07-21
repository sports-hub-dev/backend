const mongoose = require("mongoose");

/**
 * Maps a Sports Hub product (+ size variant) to an Odoo product.product record.
 * This is the bridge between the two systems' separate ID spaces.
 */
const odooProductMapSchema = new mongoose.Schema(
  {
    companyId: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   "Company",
      index: true,
    },

    // Sports Hub side
    sportsHubProductId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Product",
      required: true,
      index:    true,
    },
    sportsHubProductName: { type: String },
    sportsHubSize:        { type: String, default: null }, // null = single-size product

    // Odoo side
    odooProductTemplateId: { type: Number },          // product.template id
    odooProductId:         { type: Number, required: true }, // product.product id (variant)
    odooProductName:       { type: String },
    odooDefaultCode:       { type: String },          // Odoo internal reference / SKU
    odooLocationId:        { type: Number },          // override default warehouse location

    // Sync state
    syncEnabled:  { type: Boolean, default: true },
    lastSyncedAt: { type: Date },
    lastSyncedQty:{ type: Number },

    notes: { type: String },
  },
  { timestamps: true }
);

// Compound unique: one mapping per (company + product + size)
odooProductMapSchema.index(
  { companyId: 1, sportsHubProductId: 1, sportsHubSize: 1 },
  { unique: true }
);

odooProductMapSchema.index({ odooProductId: 1, companyId: 1 });

module.exports = mongoose.model("OdooProductMap", odooProductMapSchema);
