require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const morgan       = require("morgan");
const cookieParser = require("cookie-parser");
const path         = require("path");
const swaggerUi    = require("swagger-ui-express");

const swaggerSpec        = require("./config/swagger");
const { globalLimiter }  = require("./middleware/rateLimiter");
const errorHandler       = require("./middleware/errorHandler");
const logger             = require("./utils/logger");

// ── B2C routes ─────────────────────────────────────────────────────────────
const authRoutes    = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes   = require("./routes/orderRoutes");
const {
  promoRouter, feedbackRouter,  contactRouter,
  settingsRouter, analyticsRouter, adminRouter,
} = require("./routes/index");

// ── Vendor route ───────────────────────────────────────────────────────────
const vendorRoutes = require("./routes/b2b/vendorRoutes");

// ── Odoo ERP integration routes ────────────────────────────────────────────
const odooRoutes = require("./routes/odoo/odooRoutes");

const app = express();

// ── Security ───────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin:         process.env.CLIENT_URL || "http://localhost:3000",
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Odoo-Signature"],
}));
app.use("/api", globalLimiter);

// ── Body parsing ───────────────────────────────────────────────────────────
// Raw body for Odoo HMAC signature verification
app.use("/api/v1/odoo/inbound", express.raw({ type: "application/json" }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) req.body = JSON.parse(req.body.toString());
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ── Logging ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined", { stream: { write: (m) => logger.info(m.trim()) } }));
}

// ── Static uploads ─────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Health check ───────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  const mongoose = require("mongoose");
  const states   = ["disconnected", "connected", "connecting", "disconnecting"];
  res.status(200).json({
    success:     true,
    status:      "healthy",
    database:    states[mongoose.connection.readyState] || "unknown",
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
    version:     "2.1.0",
    features:    ["b2c", "vendor-portal", "aps", "odoo-ready"],
  });
});

// ── Swagger docs ───────────────────────────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Sports Hub API Docs",
  customCss: ".swagger-ui .topbar { background-color: #1B2A4A; }",
}));

// ── API v1 routes ──────────────────────────────────────────────────────────
const API = "/api/v1";

// Core B2C
app.use(`${API}/auth`,        authRoutes);
app.use(`${API}/products`,    productRoutes);
app.use(`${API}/contact`,     contactRouter);
app.use(`${API}/orders`,      orderRoutes);
app.use(`${API}/promo-codes`, promoRouter);
app.use(`${API}/feedback`,    feedbackRouter);
app.use(`${API}/settings`,    settingsRouter);
app.use(`${API}/analytics`,   analyticsRouter);
app.use(`${API}/admin`,       adminRouter);

// Vendor portal
app.use(`${API}/vendors`,     vendorRoutes);

// Odoo ERP (ready when needed — inbound webhook works via API key)
app.use(`${API}/odoo`,        odooRoutes);

// ── 404 — Express 5 wildcard syntax ───────────────────────────────────────
app.use("/{*path}", (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
