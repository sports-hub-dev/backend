const OdooConfig  = require("../../models/OdooConfig");
const OdooClient  = require("./odooClient");
const AppError    = require("../../utils/AppError");

// Cache clients per companyId to avoid re-authenticating on every request
const clientCache = new Map();

const odooAuthService = {
  /**
   * Get an authenticated OdooClient instance for a company.
   * Uses in-memory cache — invalidated when config is updated.
   */
  async getClient(companyId) {
    // Return cached client if available
    if (clientCache.has(String(companyId))) {
      return clientCache.get(String(companyId));
    }

    const config = await OdooConfig.findOne({ companyId, syncEnabled: true })
      .select("+apiKey +password +inboundSecret");

    if (!config) {
      throw new AppError("Odoo integration is not configured or not enabled for this company", 404);
    }

    const client = new OdooClient({
      odooUrl:      config.odooUrl,
      odooDatabase: config.odooDatabase,
      odooVersion:  config.odooVersion,
      apiKey:       config.apiKey,
      username:     config.username,
      password:     config.password,
    });

    await client.authenticate();
    clientCache.set(String(companyId), client);

    return client;
  },

  /**
   * Invalidate cached client — call after config update
   */
  invalidateCache(companyId) {
    clientCache.delete(String(companyId));
  },

  /**
   * Test connection without caching
   */
  async testConnection(companyId) {
    const config = await OdooConfig.findOne({ companyId })
      .select("+apiKey +password");

    if (!config) throw new AppError("Odoo config not found", 404);

    const client = new OdooClient({
      odooUrl:      config.odooUrl,
      odooDatabase: config.odooDatabase,
      odooVersion:  config.odooVersion,
      apiKey:       config.apiKey,
      username:     config.username,
      password:     config.password,
    });

    try {
      await client.authenticate();
      const info = await client.testConnection();

      // Update status in DB
      await OdooConfig.findOneAndUpdate(
        { companyId },
        {
          connectionStatus: "connected",
          lastConnectedAt:  new Date(),
          connectionError:  null,
        }
      );

      return info;
    } catch (err) {
      await OdooConfig.findOneAndUpdate(
        { companyId },
        { connectionStatus: "error", connectionError: err.message }
      );
      throw new AppError(`Odoo connection failed: ${err.message}`, 502);
    }
  },
};

module.exports = odooAuthService;
