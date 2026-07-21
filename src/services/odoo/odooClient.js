const axios  = require("axios");
const logger = require("../../utils/logger");

/**
 * Low-level Odoo JSON-RPC client.
 * Handles authentication, session management, and raw API calls.
 * Compatible with Odoo 14, 15, 16, 17.
 */
class OdooClient {
  constructor(config) {
    this.url      = config.odooUrl.replace(/\/$/, ""); // strip trailing slash
    this.db       = config.odooDatabase;
    this.version  = config.odooVersion || 17;
    this.apiKey   = config.apiKey   || null;
    this.username = config.username || null;
    this.password = config.password || null;
    this._uid     = null;
    this._session = null;
  }

  // ── Internal: JSON-RPC call ──────────────────────────────────────────────
  async _rpc(endpoint, params = {}) {
    const payload = {
      jsonrpc: "2.0",
      method:  "call",
      id:      Math.floor(Math.random() * 100000),
      params,
    };

    const headers = { "Content-Type": "application/json" };

    // API key auth (Odoo 14+)
    if (this.apiKey) {
      headers["Authorization"] = `Basic ${Buffer.from(`${this.username || "admin"}:${this.apiKey}`).toString("base64")}`;
    } else if (this._session) {
      headers["Cookie"] = `session_id=${this._session}`;
    }

    try {
      const res = await axios.post(`${this.url}${endpoint}`, payload, {
        headers,
        timeout: 15000,
      });

      if (res.data.error) {
        const msg = res.data.error.data?.message || res.data.error.message || "Odoo RPC error";
        throw new Error(`Odoo API error: ${msg}`);
      }

      return res.data.result;
    } catch (err) {
      if (err.response) {
        throw new Error(`Odoo HTTP ${err.response.status}: ${err.response.statusText}`);
      }
      throw err;
    }
  }

  // ── Authenticate ─────────────────────────────────────────────────────────
  async authenticate() {
    // API key: just verify connectivity — uid is always 1 placeholder for RPC
    if (this.apiKey) {
      const version = await this._rpc("/web/webclient/version_info", {});
      logger.info(`Odoo connected via API key — version: ${version?.server_version}`);
      this._uid = 1; // not actually used when apiKey is set
      return this._uid;
    }

    // Username + password session auth
    const uid = await this._rpc("/web/dataset/call_kw", {
      model:  "res.users",
      method: "authenticate",
      args:   [this.db, this.username, this.password, {}],
      kwargs: {},
    });

    if (!uid) throw new Error("Odoo authentication failed — check credentials");
    this._uid = uid;
    logger.info(`Odoo authenticated as uid ${uid}`);
    return uid;
  }

  // ── Test connection ───────────────────────────────────────────────────────
  async testConnection() {
    const info = await this._rpc("/web/webclient/version_info", {});
    return {
      connected:     true,
      serverVersion: info?.server_version || "unknown",
      serverSeries:  info?.server_serie  || "unknown",
    };
  }

  // ── Generic ORM: search_read ──────────────────────────────────────────────
  async searchRead(model, domain = [], fields = [], limit = 100, offset = 0) {
    return this._rpc("/web/dataset/call_kw", {
      model,
      method: "search_read",
      args:   [domain],
      kwargs: { fields, limit, offset },
    });
  }

  // ── Generic ORM: read ─────────────────────────────────────────────────────
  async read(model, ids, fields = []) {
    return this._rpc("/web/dataset/call_kw", {
      model,
      method: "read",
      args:   [ids],
      kwargs: { fields },
    });
  }

  // ── Generic ORM: write ────────────────────────────────────────────────────
  async write(model, ids, values) {
    return this._rpc("/web/dataset/call_kw", {
      model,
      method: "write",
      args:   [ids, values],
      kwargs: {},
    });
  }

  // ── Generic ORM: create ───────────────────────────────────────────────────
  async create(model, values) {
    return this._rpc("/web/dataset/call_kw", {
      model,
      method: "create",
      args:   [values],
      kwargs: {},
    });
  }

  // ── Get products list (product.product = variants) ────────────────────────
  async getProducts({ limit = 100, offset = 0, search = "" } = {}) {
    const domain = [["active", "=", true]];
    if (search) domain.push(["name", "ilike", search]);

    return this.searchRead(
      "product.product",
      domain,
      ["id", "name", "default_code", "product_tmpl_id", "qty_available", "type", "uom_id"],
      limit,
      offset
    );
  }

  // ── Get stock quantity for a product at a location ────────────────────────
  async getStockQty(odooProductId, locationId = null) {
    const domain = [
      ["product_id", "=", odooProductId],
      ["location_id.usage", "=", "internal"],
    ];
    if (locationId) domain.push(["location_id", "=", locationId]);

    const quants = await this.searchRead(
      "stock.quant",
      domain,
      ["product_id", "location_id", "quantity", "reserved_quantity"],
      1000
    );

    // Sum available across matching locations
    const available = quants.reduce((sum, q) => sum + (q.quantity - q.reserved_quantity), 0);
    return Math.max(0, available);
  }

  // ── Get stock for multiple products at once (bulk) ────────────────────────
  async getBulkStockQty(odooProductIds, locationId = null) {
    const domain = [
      ["product_id", "in", odooProductIds],
      ["location_id.usage", "=", "internal"],
    ];
    if (locationId) domain.push(["location_id", "=", locationId]);

    const quants = await this.searchRead(
      "stock.quant",
      domain,
      ["product_id", "location_id", "quantity", "reserved_quantity"],
      5000
    );

    // Group by product_id
    const result = {};
    for (const q of quants) {
      const pid = Array.isArray(q.product_id) ? q.product_id[0] : q.product_id;
      result[pid] = (result[pid] || 0) + Math.max(0, q.quantity - q.reserved_quantity);
    }
    return result;
  }

  // ── Create inventory adjustment (stock.quant) ─────────────────────────────
  // This is the cleanest way to set absolute stock levels in Odoo
  async setStockQty(odooProductId, locationId, newQty, reason = "Sports Hub sync") {
    // Find or create the quant
    const quants = await this.searchRead(
      "stock.quant",
      [["product_id","=",odooProductId],["location_id","=",locationId]],
      ["id","quantity"],
      1
    );

    if (quants.length > 0) {
      // Update existing quant via inventory adjustment
      return this._rpc("/web/dataset/call_kw", {
        model:  "stock.quant",
        method: "write",
        args:   [[quants[0].id], { inventory_quantity: newQty }],
        kwargs: {},
      }).then(() =>
        this._rpc("/web/dataset/call_kw", {
          model:  "stock.quant",
          method: "action_apply_inventory",
          args:   [[quants[0].id]],
          kwargs: {},
        })
      );
    } else {
      // Create new quant
      const quantId = await this.create("stock.quant", {
        product_id:           odooProductId,
        location_id:          locationId,
        inventory_quantity:   newQty,
      });
      return this._rpc("/web/dataset/call_kw", {
        model:  "stock.quant",
        method: "action_apply_inventory",
        args:   [[quantId]],
        kwargs: {},
      });
    }
  }

  // ── Create a stock picking (internal transfer / delivery) ─────────────────
  // Used for relative adjustments (e.g. deduct 5 units when order placed)
  async createStockMove({ odooProductId, locationFromId, locationToId, qty, reference = "" }) {
    // Create picking
    const pickingId = await this.create("stock.picking", {
      picking_type_id: 5, // default internal (adjust based on Odoo config)
      location_id:     locationFromId,
      location_dest_id:locationToId,
      origin:          reference,
      note:            "Sports Hub automated sync",
    });

    // Create move line
    await this.create("stock.move", {
      name:              reference || "Sports Hub sync",
      product_id:        odooProductId,
      product_uom_qty:   qty,
      product_uom:       1, // Unit
      picking_id:        pickingId,
      location_id:       locationFromId,
      location_dest_id:  locationToId,
    });

    // Validate the picking
    await this._rpc("/web/dataset/call_kw", {
      model:  "stock.picking",
      method: "button_validate",
      args:   [[pickingId]],
      kwargs: {},
    });

    return pickingId;
  }

  // ── Get warehouses ────────────────────────────────────────────────────────
  async getWarehouses() {
    return this.searchRead(
      "stock.warehouse",
      [],
      ["id", "name", "code", "lot_stock_id"],
      100
    );
  }

  // ── Get locations ─────────────────────────────────────────────────────────
  async getLocations({ usage = "internal" } = {}) {
    return this.searchRead(
      "stock.location",
      [["usage", "=", usage], ["active", "=", true]],
      ["id", "name", "complete_name", "usage"],
      200
    );
  }
}

module.exports = OdooClient;
