const crypto         = require("crypto");
const WebhookConfig  = require("../../models/WebhookConfig");
const ApiKey         = require("../../models/ApiKey");
const asyncHandler   = require("../../utils/asyncHandler");
const AppError       = require("../../utils/AppError");
const { successResponse, paginatedResponse } = require("../../utils/apiResponse");

// ── Webhook Config ─────────────────────────────────────────────────────────
exports.createWebhook = asyncHandler(async (req, res) => {
  const companyId = req.user?.companyId || req.params.companyId;
  const secret = crypto.randomBytes(32).toString("hex");
  const hook = await WebhookConfig.create({ ...req.body, companyId, secret });
  // Return secret once — never again
  successResponse(res, 201, "Webhook created. Save the secret — it will not be shown again.", {
    webhook: { _id: hook._id, url: hook.url, events: hook.events, isActive: hook.isActive },
    secret,
  });
});

exports.getWebhooks = asyncHandler(async (req, res) => {
  const companyId = req.user?.companyId || req.params.companyId;
  const hooks = await WebhookConfig.find({ companyId });
  successResponse(res, 200, "Webhooks fetched", { webhooks: hooks });
});

exports.deleteWebhook = asyncHandler(async (req, res) => {
  const hook = await WebhookConfig.findByIdAndDelete(req.params.id);
  if (!hook) throw new AppError("Webhook not found", 404);
  successResponse(res, 200, "Webhook deleted");
});

exports.toggleWebhook = asyncHandler(async (req, res) => {
  const hook = await WebhookConfig.findById(req.params.id);
  if (!hook) throw new AppError("Webhook not found", 404);
  hook.isActive  = !hook.isActive;
  hook.failCount = 0;
  await hook.save();
  successResponse(res, 200, `Webhook ${hook.isActive ? "enabled" : "disabled"}`, { webhook: hook });
});

// ── API Keys ───────────────────────────────────────────────────────────────
exports.createApiKey = asyncHandler(async (req, res) => {
  const companyId = req.user?.companyId || req.params.companyId;
  const rawKey    = `shk_live_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash   = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 16);

  const apiKey = await ApiKey.create({
    companyId,
    name:       req.body.name,
    keyHash,
    keyPrefix,
    scopes:     req.body.scopes || ["read:orders", "read:invoices"],
    expiresAt:  req.body.expiresAt || null,
    createdBy:  req.user._id,
  });

  successResponse(res, 201, "API key created. Save the key — it will not be shown again.", {
    apiKey: { _id: apiKey._id, name: apiKey.name, keyPrefix: apiKey.keyPrefix, scopes: apiKey.scopes },
    key: rawKey,
  });
});

exports.getApiKeys = asyncHandler(async (req, res) => {
  const companyId = req.user?.companyId || req.params.companyId;
  const keys = await ApiKey.find({ companyId }).select("-keyHash");
  successResponse(res, 200, "API keys fetched", { apiKeys: keys });
});

exports.revokeApiKey = asyncHandler(async (req, res) => {
  const key = await ApiKey.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!key) throw new AppError("API key not found", 404);
  successResponse(res, 200, "API key revoked");
});

// ── ERP Inbound ───────────────────────────────────────────────────────────
exports.erpInbound = asyncHandler(async (req, res) => {
  // companyId injected by apiKeyAuth middleware
  const { event, payload } = req.body;
  const logger = require("../../utils/logger");
  logger.info(`ERP inbound event [company:${req.companyId}]: ${event}`);

  // Handle inbound inventory updates from ERP
  if (event === "inventory.update" && payload?.productId) {
    const inventoryService = require("../../services/inventoryService");
    await inventoryService.updateStock({
      productId:  payload.productId,
      size:       payload.size,
      newStock:   payload.newStock,
      changeType: "manual_increase",
      notes:      `ERP sync — ref: ${payload.ref || "N/A"}`,
    });
  }

  successResponse(res, 200, "Event received");
});
