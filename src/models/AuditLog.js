const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userName:      { type: String },
    companyId:     { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    action:        { type: String, required: true, index: true },
    resourceType:  { type: String },
    resourceId:    { type: mongoose.Schema.Types.ObjectId },
    previousValue: { type: mongoose.Schema.Types.Mixed },
    newValue:      { type: mongoose.Schema.Types.Mixed },
    ipAddress:     { type: String },
    userAgent:     { type: String },
    notes:         { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
