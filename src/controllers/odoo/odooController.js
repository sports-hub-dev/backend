const crypto          = require("crypto");
const OdooConfig      = require("../../models/OdooConfig");
const OdooProductMap  = require("../../models/OdooProductMap");
const OdooSyncLog     = require("../../models/OdooSyncLog");
const Product         = require("../../models/Product");
const odooAuthService = require("../../services/odoo/odooAuthService");
const odooSyncService = require("../../services/odoo/odooSyncService");
const asyncHandler    = require("../../utils/asyncHandler");
const AppError        = require("../../utils/AppError");
const { successResponse, paginatedResponse } = require("../../utils/apiResponse");
const { PAGINATION } = require("../../utils/constants");

// ── Config ─────────────────────────────────────────────────────────────────

exports.saveConfig = asyncHandler(async (req, res) => {
  const {
    odooUrl, odooDatabase, odooVersion,
    apiKey, username, password,
    defaultWarehouseId, defaultLocationId, defaultSourceLocationId,
    syncEnabled, inboundSyncEnabled, outboundSyncEnabled,
    reconcileEnabled, reconcileSchedule, sourceOfTruth, notes,
  } = req.body;

  const companyId = req.params.companyId || req.user.companyId;
  if (!companyId) throw new AppError("companyId is required", 400);

  // Generate inbound secret if not already set
  const existing = await OdooConfig.findOne({ companyId }).select("+inboundSecret");
  const inboundSecret = existing?.inboundSecret || crypto.randomBytes(32).toString("hex");

  const config = await OdooConfig.findOneAndUpdate(
    { companyId },
    {
      odooUrl, odooDatabase, odooVersion,
      ...(apiKey    && { apiKey }),
      ...(username  && { username }),
      ...(password  && { password }),
      defaultWarehouseId, defaultLocationId, defaultSourceLocationId,
      syncEnabled, inboundSyncEnabled, outboundSyncEnabled,
      reconcileEnabled, reconcileSchedule, sourceOfTruth, notes,
      inboundSecret,
      connectionStatus: "unknown",
    },
    { upsert: true, new: true, runValidators: true }
  );

  // Invalidate cached client so next call re-authenticates
  odooAuthService.invalidateCache(companyId);

  // Restart reconcile scheduler if needed
  const { scheduleReconcile } = require("../../jobs/odooReconcileJob");
  scheduleReconcile(String(companyId), config.reconcileSchedule);

  successResponse(res, 200, "Odoo configuration saved", {
    config: {
      ...config.toObject(),
      inboundSecret, // return once so admin can configure Odoo's Automated Action
    }
  });
});

exports.getConfig = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const config = await OdooConfig.findOne({ companyId });
  if (!config) throw new AppError("Odoo configuration not found for this company", 404);
  successResponse(res, 200, "Odoo config fetched", { config });
});

exports.testConnection = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const info = await odooAuthService.testConnection(companyId);
  successResponse(res, 200, "Odoo connection successful", { connection: info });
});

// ── Product discovery & mapping ────────────────────────────────────────────

exports.getOdooProducts = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const { search = "", limit = 100, offset = 0 } = req.query;
  const client   = await odooAuthService.getClient(companyId);
  const products = await client.getProducts({ search, limit: +limit, offset: +offset });
  successResponse(res, 200, "Odoo products fetched", { products, count: products.length });
});

exports.getOdooWarehouses = asyncHandler(async (req, res) => {
  const companyId  = req.params.companyId || req.user.companyId;
  const client     = await odooAuthService.getClient(companyId);
  const warehouses = await client.getWarehouses();
  successResponse(res, 200, "Odoo warehouses fetched", { warehouses });
});

exports.getOdooLocations = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const client    = await odooAuthService.getClient(companyId);
  const locations = await client.getLocations({ usage: req.query.usage || "internal" });
  successResponse(res, 200, "Odoo locations fetched", { locations });
});

// ── Product Mappings ───────────────────────────────────────────────────────

exports.createMapping = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const {
    sportsHubProductId, sportsHubSize,
    odooProductId, odooProductTemplateId, odooProductName, odooDefaultCode,
    odooLocationId, notes,
  } = req.body;

  // Validate Sports Hub product exists
  const product = await Product.findById(sportsHubProductId);
  if (!product) throw new AppError("Sports Hub product not found", 404);

  const mapping = await OdooProductMap.findOneAndUpdate(
    { companyId, sportsHubProductId, sportsHubSize: sportsHubSize || null },
    {
      companyId,
      sportsHubProductId,
      sportsHubProductName: product.name,
      sportsHubSize:        sportsHubSize || null,
      odooProductId:        +odooProductId,
      odooProductTemplateId,
      odooProductName,
      odooDefaultCode,
      odooLocationId,
      syncEnabled: true,
      notes,
    },
    { upsert: true, new: true, runValidators: true }
  );

  successResponse(res, 201, "Product mapping created", { mapping });
});

exports.getMappings = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;
  const skip = (page - 1) * limit;

  const [mappings, total] = await Promise.all([
    OdooProductMap.find({ companyId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(+limit)
      .populate("sportsHubProductId", "name price category"),
    OdooProductMap.countDocuments({ companyId }),
  ]);
  paginatedResponse(res, "Mappings fetched", mappings, page, limit, total);
});

exports.deleteMapping = asyncHandler(async (req, res) => {
  const mapping = await OdooProductMap.findByIdAndDelete(req.params.mappingId);
  if (!mapping) throw new AppError("Mapping not found", 404);
  successResponse(res, 200, "Mapping deleted");
});

exports.toggleMapping = asyncHandler(async (req, res) => {
  const mapping = await OdooProductMap.findById(req.params.mappingId);
  if (!mapping) throw new AppError("Mapping not found", 404);
  mapping.syncEnabled = !mapping.syncEnabled;
  await mapping.save();
  successResponse(res, 200, `Mapping ${mapping.syncEnabled ? "enabled" : "disabled"}`, { mapping });
});

// ── Manual sync triggers ───────────────────────────────────────────────────

exports.triggerFullSync = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  // Run in background — respond immediately
  odooSyncService.fullOutboundSync(companyId)
    .then(r => require("../../utils/logger").info(`Full Odoo sync complete for ${companyId}:`, r))
    .catch(err => require("../../utils/logger").error(`Full Odoo sync error: ${err.message}`));

  successResponse(res, 202, "Full sync initiated. Check sync logs for progress.");
});

exports.triggerReconcile = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const result = await odooSyncService.reconcile(companyId);
  successResponse(res, 200, "Reconciliation complete", { result });
});

exports.retryFailed = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const result = await odooSyncService.retryFailedSyncs(companyId);
  successResponse(res, 200, "Retry complete", { result });
});

// ── Sync logs ──────────────────────────────────────────────────────────────

exports.getSyncLogs = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const { page = 1, limit = 20, status, direction } = req.query;
  const filter = { companyId };
  if (status)    filter.status    = status;
  if (direction) filter.direction = direction;

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    OdooSyncLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(+limit)
      .populate("sportsHubProductId", "name"),
    OdooSyncLog.countDocuments(filter),
  ]);
  paginatedResponse(res, "Sync logs fetched", logs, page, limit, total);
});

// ── Inbound webhook from Odoo ──────────────────────────────────────────────
// Called by Odoo's Automated Action when stock changes in Odoo

exports.odooInbound = asyncHandler(async (req, res) => {
  const companyId = req.companyId; // set by apiKeyAuth middleware

  // Optional HMAC verification using the inboundSecret
  const signature = req.headers["x-odoo-signature"];
  if (signature) {
    const config = await OdooConfig.findOne({ companyId }).select("+inboundSecret");
    if (config?.inboundSecret) {
      const expected = crypto
        .createHmac("sha256", config.inboundSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");
      if (signature !== expected) {
        throw new AppError("Invalid Odoo signature", 401);
      }
    }
  }

  const { event, payload } = req.body;

  if (event === "inventory.update" && payload?.odooProductId !== undefined) {
    const result = await odooSyncService.applyInboundSync({
      companyId,
      odooProductId: payload.odooProductId,
      newQty:        payload.newQty ?? payload.qty_available,
      ref:           payload.ref || payload.reference || "",
    });
    return successResponse(res, 200, "Inbound sync applied", { result });
  }

  // Unknown event — acknowledge receipt but take no action
  successResponse(res, 200, `Event "${event}" acknowledged — no action taken`);
});

// ── Odoo Automated Action script generator ────────────────────────────────
// Returns the Python snippet the client pastes into Odoo's Server Action

exports.getOdooScript = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.companyId;
  const config = await OdooConfig.findOne({ companyId }).select("+inboundSecret");
  if (!config) throw new AppError("Odoo config not found", 404);

  // Find the company's API key
  const ApiKey = require("../../models/ApiKey");
  const apiKey = await ApiKey.findOne({ companyId, isActive: true }).select("-keyHash");

  const baseUrl  = process.env.BASE_URL || "http://localhost:5000";
  const endpoint = `${baseUrl}/api/v1/odoo/inbound`;

  const script = `# Sports Hub — Odoo Automated Action Script
# Paste this into: Settings → Technical → Automation → Automated Actions
# Trigger: stock.move (on write, when state = done)
#
# Model: Stock Move (stock.move)
# Trigger: On record update
# Before Update Filter: state != 'done'
# Filter: state = 'done'
# Action: Execute Code (Python)

import requests
import json
import hmac
import hashlib

API_KEY    = "${apiKey ? "shk_live_YOUR_KEY_FROM_SPORTS_HUB" : "CREATE_AN_API_KEY_FIRST"}"
ENDPOINT   = "${endpoint}"
SECRET     = "${config.inboundSecret || "YOUR_INBOUND_SECRET"}"

for move in records:
    if move.state != 'done':
        continue

    product = move.product_id
    qty_available = product.with_context(location=move.location_dest_id.id).qty_available

    payload = {
        "event": "inventory.update",
        "payload": {
            "odooProductId": product.id,
            "odooProductName": product.name,
            "odooDefaultCode": product.default_code or "",
            "newQty": qty_available,
            "reference": move.reference or "",
            "locationId": move.location_dest_id.id,
            "locationName": move.location_dest_id.complete_name,
            "moveType": move.picking_type_id.code if move.picking_type_id else "unknown"
        }
    }

    body_str = json.dumps(payload, separators=(',', ':'))
    signature = hmac.new(
        SECRET.encode('utf-8'),
        body_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    try:
        requests.post(
            ENDPOINT,
            data=body_str,
            headers={
                "Content-Type": "application/json",
                "X-API-Key": API_KEY,
                "X-Odoo-Signature": signature,
            },
            timeout=10
        )
    except Exception as e:
        log.warning("Sports Hub sync failed: " + str(e))
`;

  successResponse(res, 200, "Odoo script generated", {
    script,
    instructions: {
      step1: "In Odoo, go to Settings → Technical → Automation → Automated Actions",
      step2: "Create a new action with Model = 'Stock Move' (stock.move)",
      step3: "Set Trigger to 'On record update', Before Update Filter: state != 'done', Filter: state = 'done'",
      step4: "Set Action to 'Execute Code (Python)' and paste the script above",
      step5: `Replace API_KEY with a key generated at: POST ${baseUrl}/api/v1/integrations/api-keys`,
      step6: "Save and activate the Automated Action",
      endpoint,
      inboundSecret: config.inboundSecret,
    }
  });
});
