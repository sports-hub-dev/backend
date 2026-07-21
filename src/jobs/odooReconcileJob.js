const cron            = require("node-cron");
const logger          = require("../utils/logger");
const OdooConfig      = require("../models/OdooConfig");
const odooSyncService = require("../services/odoo/odooSyncService");

// Map of companyId → active cron task
const activeTasks = new Map();

/**
 * Schedule or reschedule the reconcile cron job for a company.
 * Called on server startup and whenever a company updates their Odoo config.
 */
const scheduleReconcile = (companyId, cronExpression) => {
  // Cancel existing task for this company
  if (activeTasks.has(companyId)) {
    activeTasks.get(companyId).stop();
    activeTasks.delete(companyId);
    logger.info(`Odoo reconcile job cancelled for company ${companyId}`);
  }

  if (!cronExpression) return;

  if (!cron.validate(cronExpression)) {
    logger.warn(`Invalid cron expression "${cronExpression}" for company ${companyId} — skipping`);
    return;
  }

  const task = cron.schedule(cronExpression, async () => {
    logger.info(`Odoo reconcile job running for company ${companyId} [${cronExpression}]`);
    try {
      const result = await odooSyncService.reconcile(companyId);
      logger.info(`Reconcile complete for ${companyId}:`, result);
    } catch (err) {
      logger.error(`Reconcile job error for ${companyId}: ${err.message}`);
    }
  }, { scheduled: true, timezone: "Africa/Cairo" });

  activeTasks.set(companyId, task);
  logger.info(`Odoo reconcile job scheduled for company ${companyId} — ${cronExpression}`);
};

/**
 * Retry failed sync logs — runs every 30 minutes
 */
const startRetryJob = () => {
  cron.schedule("*/30 * * * *", async () => {
    logger.info("Odoo retry job running...");
    try {
      const result = await odooSyncService.retryFailedSyncs();
      if (result.retried > 0) logger.info(`Odoo retry job: retried ${result.retried} failed syncs`);
    } catch (err) {
      logger.error(`Odoo retry job error: ${err.message}`);
    }
  }, { scheduled: true, timezone: "Africa/Cairo" });
  logger.info("Odoo retry job scheduled — every 30 minutes");
};

/**
 * On server startup: load all active reconcile configs and schedule their jobs.
 */
const initJobs = async () => {
  try {
    const configs = await OdooConfig.find({
      syncEnabled:      true,
      reconcileEnabled: true,
      reconcileSchedule:{ $exists: true, $ne: null },
    });

    for (const config of configs) {
      scheduleReconcile(String(config.companyId), config.reconcileSchedule);
    }

    startRetryJob();
    logger.info(`Odoo jobs initialised — ${configs.length} reconcile schedule(s) loaded`);
  } catch (err) {
    logger.error(`Odoo job init error: ${err.message}`);
  }
};

module.exports = { initJobs, scheduleReconcile, startRetryJob };
