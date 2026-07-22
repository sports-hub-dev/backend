require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/database");
const { validateConfig, port } = require("./config/server");
const logger = require("./utils/logger");
const Settings = require("./models/Settings");
const PricingTier = require("./models/PricingTier");
const { initJobs } = require("./jobs/odooReconcileJob");
const { PRICING_TIERS } = require("./utils/constants");

console.log("BOOT: process starting, node version:", process.version);
// Validate env at startup
try { validateConfig(); } catch (err) {
  logger.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

const seedDefaults = async () => {
  // Shipping fee
  if (!(await Settings.findOne({ key: "shippingFee" }))) {
    await Settings.create({ key: "shippingFee", value: 75, description: "Fixed shipping fee in EGP" });
    logger.info("Seeded default shipping fee: 75 EGP");
  }

  // Pricing tiers
  const tiers = [
    { name: PRICING_TIERS.STANDARD, label: "Standard", discountPercentage: 0, paymentTermsDays: 0, minMonthlySpend: 0 },
    { name: PRICING_TIERS.BRONZE, label: "Bronze", discountPercentage: 5, paymentTermsDays: 15, minMonthlySpend: 5000 },
    { name: PRICING_TIERS.SILVER, label: "Silver", discountPercentage: 10, paymentTermsDays: 30, minMonthlySpend: 20000 },
    { name: PRICING_TIERS.GOLD, label: "Gold", discountPercentage: 18, paymentTermsDays: 60, minMonthlySpend: 50000 },
    { name: PRICING_TIERS.PLATINUM, label: "Platinum", discountPercentage: 25, paymentTermsDays: 90, minMonthlySpend: 0 },
  ];
  for (const t of tiers) {
    await PricingTier.findOneAndUpdate({ name: t.name }, t, { upsert: true });
  }
  logger.info("Pricing tiers seeded");
};

const startServer = async () => {
  await connectDB();
  await seedDefaults();

  // Start Odoo reconcile + retry jobs
  await initJobs();
  console.log("BOOT: about to call app.listen()");
  const server = app.listen(port, () => {
    console.log("BOOT: inside app.listen callback — SUCCESS");
    // logger.info(`🚀 Sports Hub API v2.1.0 running on port ${port} [${process.env.NODE_ENV}]`);
    // logger.info(`📖 Swagger docs  : http://localhost:${port}/api/docs`);
    // logger.info(`❤️  Health check  : http://localhost:${port}/health`);
    // logger.info(`🏢 B2B portal    : http://localhost:${port}/api/v1/b2b`);
    // logger.info(`🏪 Vendor portal : http://localhost:${port}/api/v1/vendors`);
    // logger.info(`🔗 Odoo ERP      : http://localhost:${port}/api/v1/odoo`);
    console.log("BOOT: inside app.listen callback — SUCCESS 2");
  });

  const shutdown = (sig) => {
    logger.info(`${sig} received — shutting down gracefully`);
    server.close(async () => {
      const mongoose = require("mongoose");
      await mongoose.connection.close();
      logger.info("MongoDB closed. Bye.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
  process.on("uncaughtException", (err) => {
    logger.error(`Uncaught Exception: ${err.message}`);
    process.exit(1);
  });
};

startServer();
