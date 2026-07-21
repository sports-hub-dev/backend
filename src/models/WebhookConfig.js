const mongoose = require("mongoose");
const { WEBHOOK_EVENTS } = require("../utils/constants");

const webhookConfigSchema = new mongoose.Schema(
  {
    companyId:  { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name:       { type: String, required: true, trim: true },
    url:        { type: String, required: true, trim: true },
    secret:     { type: String, required: true, select: false }, // HMAC signing secret
    events:     [{ type: String, enum: Object.values(WEBHOOK_EVENTS) }],
    isActive:   { type: Boolean, default: true },
    failCount:  { type: Number, default: 0 },
    lastSuccess:{ type: Date },
    lastFailure:{ type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebhookConfig", webhookConfigSchema);
