const mongoose = require("mongoose");

// Long-lived API keys for ERP system integrations
const apiKeySchema = new mongoose.Schema(
  {
    companyId:   { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name:        { type: String, required: true, trim: true },
    keyHash:     { type: String, required: true, unique: true, select: false }, // hashed
    keyPrefix:   { type: String, required: true },  // first 8 chars shown in UI
    scopes:      [{ type: String, enum: ["read:orders", "read:invoices", "write:inventory", "read:products"] }],
    isActive:    { type: Boolean, default: true },
    lastUsedAt:  { type: Date },
    expiresAt:   { type: Date },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

apiKeySchema.index({ createdAt: -1 });

module.exports = mongoose.model("ApiKey", apiKeySchema);
