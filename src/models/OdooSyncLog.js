const mongoose = require("mongoose");

/**
 * Logs every sync attempt between Sports Hub and Odoo.
 * Used for debugging, auditing, and retry tracking.
 */
const odooSyncLogSchema = new mongoose.Schema(
  {
    companyId: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   "Company",
      index: true,
    },

    // Direction
    direction: {
      type: String,
      enum: ["outbound", "inbound", "reconcile"],
      required: true,
      index: true,
    },

    // What triggered this sync
    triggerType: {
      type: String,
      enum: [
        "order_placed",
        "order_cancelled",
        "manual_stock_update",
        "odoo_webhook",
        "scheduled_reconcile",
        "manual_full_sync",
        "api_call",
      ],
      required: true,
    },

    // Products involved
    sportsHubProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    sportsHubSize:      { type: String },
    odooProductId:      { type: Number },

    // Stock values
    stockBefore:    { type: Number },
    stockAfter:     { type: Number },
    changeAmount:   { type: Number },

    // Odoo API call details
    odooEndpoint:   { type: String },
    odooPayload:    { type: mongoose.Schema.Types.Mixed },
    odooResponse:   { type: mongoose.Schema.Types.Mixed },

    // Result
    status:       { type: String, enum: ["success","failed","pending","skipped"], default: "pending", index: true },
    errorMessage: { type: String },
    retryCount:   { type: Number, default: 0 },
    resolvedAt:   { type: Date },

    // Related records
    relatedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    relatedPOId:    { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder" },
  },
  { timestamps: true }
);

odooSyncLogSchema.index({ createdAt: -1 });
odooSyncLogSchema.index({ status: 1, retryCount: 1 }); // for retry queries

module.exports = mongoose.model("OdooSyncLog", odooSyncLogSchema);
