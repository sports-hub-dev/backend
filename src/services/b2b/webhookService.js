const crypto       = require("crypto");
const WebhookConfig = require("../../models/WebhookConfig");
const logger        = require("../../utils/logger");

const webhookService = {

  async dispatch(companyId, event, payload) {
    const configs = await WebhookConfig.find({ companyId, isActive: true, events: event }).select("+secret");
    if (!configs.length) return;

    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

    for (const config of configs) {
      try {
        const sig = crypto.createHmac("sha256", config.secret).update(body).digest("hex");
        const res = await fetch(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-SportHub-Signature": `sha256=${sig}`,
            "X-SportHub-Event": event,
          },
          body,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (res.ok) {
          config.lastSuccess = new Date();
          config.failCount   = 0;
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err) {
        config.lastFailure = new Date();
        config.failCount   = (config.failCount || 0) + 1;
        if (config.failCount >= 5) {
          config.isActive = false;
          logger.warn(`Webhook ${config._id} disabled after 5 consecutive failures`);
        }
        logger.error(`Webhook delivery failed [${config.url}]: ${err.message}`);
      }
      await config.save();
    }
  },

  verifySignature(rawBody, signature, secret) {
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  },
};

module.exports = webhookService;
