const mongoose = require("mongoose");

/**
 * Odoo connection configuration per company.
 * One document per company that has Odoo integration enabled.
 */
const odooConfigSchema = new mongoose.Schema(
  {
    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Company",
      unique:   true,
      index:    true,
    },

    // Connection
    odooUrl:      { type: String, required: true, trim: true },   // e.g. https://mycompany.odoo.com
    odooDatabase: { type: String, required: true, trim: true },   // database name
    odooVersion:  { type: Number, default: 17, enum: [14,15,16,17] },

    // Auth — API key (Odoo 14+) preferred over username/password
    apiKey:       { type: String, select: false },                 // Odoo API key
    username:     { type: String },                                // fallback
    password:     { type: String, select: false },                 // fallback

    // Warehouse defaults
    defaultWarehouseId:      { type: Number },   // Odoo stock.warehouse id
    defaultLocationId:       { type: Number },   // Odoo stock.location id (e.g. WH/Stock)
    defaultSourceLocationId: { type: Number },   // for outgoing moves

    // Sync settings
    syncEnabled:          { type: Boolean, default: false },
    inboundSyncEnabled:   { type: Boolean, default: false }, // Odoo → Sports Hub
    outboundSyncEnabled:  { type: Boolean, default: false }, // Sports Hub → Odoo
    reconcileEnabled:     { type: Boolean, default: false }, // scheduled reconciliation
    reconcileSchedule:    { type: String, default: "0 2 * * *" }, // cron — default 2am daily
    sourceOfTruth:        { type: String, enum: ["sportshub", "odoo"], default: "sportshub" },

    // Status
    lastConnectedAt:  { type: Date },
    lastSyncAt:       { type: Date },
    connectionStatus: { type: String, enum: ["unknown","connected","error"], default: "unknown" },
    connectionError:  { type: String },

    // Inbound webhook security
    inboundSecret: { type: String, select: false }, // HMAC secret for Odoo → Sports Hub calls

    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OdooConfig", odooConfigSchema);
