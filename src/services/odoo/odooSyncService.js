const OdooConfig      = require("../../models/OdooConfig");
const OdooProductMap  = require("../../models/OdooProductMap");
const OdooSyncLog     = require("../../models/OdooSyncLog");
const Product         = require("../../models/Product");
const odooAuthService = require("./odooAuthService");
const logger          = require("../../utils/logger");

const odooSyncService = {

  // ── OUTBOUND: Sports Hub → Odoo ──────────────────────────────────────────

  /**
   * Called after any stock change in Sports Hub.
   * Finds all Odoo mappings for this product/size and syncs stock to Odoo.
   */
  async syncStockToOdoo({ productId, size = null, newStock, triggerType, relatedOrderId = null }) {
    // Find all company mappings for this product+size
    const query = { sportsHubProductId: productId, syncEnabled: true };
    if (size !== undefined) query.sportsHubSize = size || null;

    const mappings = await OdooProductMap.find(query);
    if (!mappings.length) return; // no Odoo mappings — silently skip

    for (const mapping of mappings) {
      const log = await OdooSyncLog.create({
        companyId:          mapping.companyId,
        direction:          "outbound",
        triggerType,
        sportsHubProductId: productId,
        sportsHubSize:      size,
        odooProductId:      mapping.odooProductId,
        stockAfter:         newStock,
        changeAmount:       newStock - (mapping.lastSyncedQty ?? newStock),
        status:             "pending",
        relatedOrderId,
      });

      try {
        // Check if outbound sync is enabled for this company
        const config = await OdooConfig.findOne({
          companyId: mapping.companyId,
          syncEnabled: true,
          outboundSyncEnabled: true,
        });
        if (!config) {
          await OdooSyncLog.findByIdAndUpdate(log._id, { status: "skipped", errorMessage: "Outbound sync disabled" });
          continue;
        }

        const locationId = mapping.odooLocationId || config.defaultLocationId;
        if (!locationId) {
          await OdooSyncLog.findByIdAndUpdate(log._id, { status: "skipped", errorMessage: "No Odoo location configured" });
          continue;
        }

        const client = await odooAuthService.getClient(mapping.companyId);

        // Set absolute stock in Odoo
        await client.setStockQty(mapping.odooProductId, locationId, newStock, `Sports Hub sync — ${triggerType}`);

        // Update mapping's last sync info
        await OdooProductMap.findByIdAndUpdate(mapping._id, {
          lastSyncedAt:  new Date(),
          lastSyncedQty: newStock,
        });

        await OdooSyncLog.findByIdAndUpdate(log._id, {
          status: "success",
          odooEndpoint: "/web/dataset/call_kw → stock.quant",
          resolvedAt: new Date(),
        });

        logger.info(`Odoo outbound sync OK — product ${productId} size ${size || "N/A"} → qty ${newStock}`);
      } catch (err) {
        logger.error(`Odoo outbound sync FAILED — ${err.message}`);
        await OdooSyncLog.findByIdAndUpdate(log._id, {
          status:       "failed",
          errorMessage: err.message,
          retryCount:   (log.retryCount || 0) + 1,
        });
      }
    }
  },

  /**
   * Sync stock for ALL mapped products for a company (full outbound sync).
   */
  async fullOutboundSync(companyId) {
    const mappings = await OdooProductMap.find({ companyId, syncEnabled: true });
    const results  = { success: 0, failed: 0, skipped: 0 };

    for (const mapping of mappings) {
      try {
        const product = await Product.findById(mapping.sportsHubProductId);
        if (!product || product.isDeleted) { results.skipped++; continue; }

        let currentStock;
        if (product.hasSizeVariants && mapping.sportsHubSize) {
          const variant = product.variants.find(v => v.size === mapping.sportsHubSize);
          currentStock = variant ? variant.stock : 0;
        } else {
          currentStock = product.stock;
        }

        await this.syncStockToOdoo({
          productId:   mapping.sportsHubProductId,
          size:        mapping.sportsHubSize,
          newStock:    currentStock,
          triggerType: "manual_full_sync",
        });
        results.success++;
      } catch (err) {
        logger.error(`Full sync error for mapping ${mapping._id}: ${err.message}`);
        results.failed++;
      }
    }

    await OdooConfig.findOneAndUpdate({ companyId }, { lastSyncAt: new Date() });
    return results;
  },

  // ── INBOUND: Odoo → Sports Hub ───────────────────────────────────────────

  /**
   * Called when Odoo pushes a stock change to Sports Hub.
   * Updates Sports Hub stock and logs the event.
   */
  async applyInboundSync({ companyId, odooProductId, newQty, ref = "" }) {
    const log = await OdooSyncLog.create({
      companyId,
      direction:    "inbound",
      triggerType:  "odoo_webhook",
      odooProductId,
      stockAfter:   newQty,
      status:       "pending",
    });

    try {
      // Find Sports Hub product from mapping
      const mapping = await OdooProductMap.findOne({ companyId, odooProductId, syncEnabled: true });
      if (!mapping) {
        await OdooSyncLog.findByIdAndUpdate(log._id, { status: "skipped", errorMessage: `No mapping found for Odoo product ${odooProductId}` });
        return { skipped: true };
      }

      const config = await OdooConfig.findOne({ companyId, inboundSyncEnabled: true });
      if (!config) {
        await OdooSyncLog.findByIdAndUpdate(log._id, { status: "skipped", errorMessage: "Inbound sync disabled" });
        return { skipped: true };
      }

      const product = await Product.findById(mapping.sportsHubProductId);
      if (!product || product.isDeleted) {
        await OdooSyncLog.findByIdAndUpdate(log._id, { status: "skipped", errorMessage: "Sports Hub product not found" });
        return { skipped: true };
      }

      let stockBefore;
      if (product.hasSizeVariants && mapping.sportsHubSize) {
        const variant = product.variants.find(v => v.size === mapping.sportsHubSize);
        if (!variant) {
          await OdooSyncLog.findByIdAndUpdate(log._id, { status: "skipped", errorMessage: `Size ${mapping.sportsHubSize} not found` });
          return { skipped: true };
        }
        stockBefore    = variant.stock;
        variant.stock  = newQty;
      } else {
        stockBefore    = product.stock;
        product.stock  = newQty;
      }

      await product.save();

      // Log in InventoryLog
      const InventoryLog = require("../../models/InventoryLog");
      await InventoryLog.create({
        product:      product._id,
        productName:  product.name,
        sizeVariant:  mapping.sportsHubSize || null,
        previousStock: stockBefore,
        newStock:     newQty,
        changeAmount: newQty - stockBefore,
        changeType:   "manual_increase",
        notes:        `Odoo inbound sync — ref: ${ref}`,
      });

      await OdooProductMap.findByIdAndUpdate(mapping._id, {
        lastSyncedAt:  new Date(),
        lastSyncedQty: newQty,
      });

      await OdooSyncLog.findByIdAndUpdate(log._id, {
        sportsHubProductId: mapping.sportsHubProductId,
        sportsHubSize:      mapping.sportsHubSize,
        stockBefore,
        status:     "success",
        resolvedAt: new Date(),
      });

      logger.info(`Odoo inbound sync OK — Odoo product ${odooProductId} → Sports Hub ${product.name} qty ${newQty}`);
      return { success: true, productName: product.name, newStock: newQty };
    } catch (err) {
      logger.error(`Odoo inbound sync FAILED — ${err.message}`);
      await OdooSyncLog.findByIdAndUpdate(log._id, {
        status:       "failed",
        errorMessage: err.message,
      });
      throw err;
    }
  },

  // ── RECONCILIATION ────────────────────────────────────────────────────────

  /**
   * Compare stock in both systems and flag/fix discrepancies.
   * Runs on schedule (e.g. nightly 2am).
   */
  async reconcile(companyId) {
    const config   = await OdooConfig.findOne({ companyId, syncEnabled: true, reconcileEnabled: true })
      .select("+apiKey +password");
    if (!config) return { skipped: true, reason: "Reconcile not enabled" };

    const mappings = await OdooProductMap.find({ companyId, syncEnabled: true });
    const results  = { checked: 0, inSync: 0, discrepancies: [], fixed: 0, errors: 0 };

    const client = await odooAuthService.getClient(companyId);

    // Bulk fetch Odoo stock for all mapped product IDs
    const odooIds     = [...new Set(mappings.map(m => m.odooProductId))];
    const locationId  = config.defaultLocationId;
    const odooStocks  = locationId
      ? await client.getBulkStockQty(odooIds, locationId)
      : await client.getBulkStockQty(odooIds);

    for (const mapping of mappings) {
      results.checked++;
      try {
        const product = await Product.findById(mapping.sportsHubProductId);
        if (!product) { results.errors++; continue; }

        let shStock;
        if (product.hasSizeVariants && mapping.sportsHubSize) {
          const v = product.variants.find(v => v.size === mapping.sportsHubSize);
          shStock = v ? v.stock : 0;
        } else {
          shStock = product.stock;
        }

        const odooStock = odooStocks[mapping.odooProductId] ?? null;
        if (odooStock === null) { results.errors++; continue; }

        const diff = Math.abs(shStock - odooStock);
        if (diff === 0) {
          results.inSync++;
          continue;
        }

        results.discrepancies.push({
          sportsHubProductId: mapping.sportsHubProductId,
          productName:        product.name,
          size:               mapping.sportsHubSize,
          odooProductId:      mapping.odooProductId,
          sportsHubStock:     shStock,
          odooStock,
          diff,
        });

        // Auto-fix based on source of truth
        if (config.sourceOfTruth === "sportshub") {
          // Push Sports Hub stock to Odoo
          if (locationId) {
            await client.setStockQty(mapping.odooProductId, locationId, shStock, "Reconcile — Sports Hub source of truth");
            results.fixed++;
          }
        } else if (config.sourceOfTruth === "odoo") {
          // Pull Odoo stock into Sports Hub
          await this.applyInboundSync({ companyId, odooProductId: mapping.odooProductId, newQty: odooStock, ref: "reconcile" });
          results.fixed++;
        }

        // Log it
        await OdooSyncLog.create({
          companyId,
          direction:          "reconcile",
          triggerType:        "scheduled_reconcile",
          sportsHubProductId: mapping.sportsHubProductId,
          sportsHubSize:      mapping.sportsHubSize,
          odooProductId:      mapping.odooProductId,
          stockBefore:        config.sourceOfTruth === "sportshub" ? odooStock : shStock,
          stockAfter:         config.sourceOfTruth === "sportshub" ? shStock   : odooStock,
          changeAmount:       config.sourceOfTruth === "sportshub" ? shStock - odooStock : odooStock - shStock,
          status:             "success",
          resolvedAt:         new Date(),
        });
      } catch (err) {
        logger.error(`Reconcile error for mapping ${mapping._id}: ${err.message}`);
        results.errors++;
      }
    }

    await OdooConfig.findOneAndUpdate({ companyId }, { lastSyncAt: new Date() });
    return results;
  },

  // ── RETRY failed sync logs ────────────────────────────────────────────────
  async retryFailedSyncs(companyId = null) {
    const filter = { status: "failed", retryCount: { $lt: 5 } };
    if (companyId) filter.companyId = companyId;

    const failedLogs = await OdooSyncLog.find(filter).sort({ createdAt: 1 }).limit(50);
    let retried = 0;

    for (const log of failedLogs) {
      try {
        if (log.direction === "outbound" && log.sportsHubProductId) {
          const product = await Product.findById(log.sportsHubProductId);
          if (!product) continue;

          let stock;
          if (product.hasSizeVariants && log.sportsHubSize) {
            const v = product.variants.find(v => v.size === log.sportsHubSize);
            stock = v ? v.stock : 0;
          } else {
            stock = product.stock;
          }

          await this.syncStockToOdoo({
            productId:   log.sportsHubProductId,
            size:        log.sportsHubSize,
            newStock:    stock,
            triggerType: "api_call",
          });
          retried++;
        }
      } catch (err) {
        await OdooSyncLog.findByIdAndUpdate(log._id, {
          retryCount:   (log.retryCount || 0) + 1,
          errorMessage: err.message,
        });
      }
    }

    return { retried };
  },
};

module.exports = odooSyncService;
