const AppError = require("../utils/AppError");
const { COMPANY_ROLES, ROLES } = require("../utils/constants");

/**
 * Require user to belong to an active company
 */
const requireCompany = (req, res, next) => {
  if (!req.user?.companyId) {
    return next(new AppError("This route requires a company account", 403));
  }
  next();
};

/**
 * Restrict to specific company roles
 * Always allows platform admins through
 */
const restrictToCompanyRole = (...roles) => (req, res, next) => {
  if (req.user?.role === ROLES.ADMIN) return next();
  if (!req.user?.companyRole || !roles.includes(req.user.companyRole)) {
    return next(new AppError(`Requires company role: ${roles.join(" or ")}`, 403));
  }
  next();
};

/**
 * Ensure the companyId in the route param matches the user's company
 * Admins bypass this check
 */
const ownCompanyOnly = (req, res, next) => {
  if (req.user?.role === ROLES.ADMIN) return next();
  const paramId = req.params.companyId || req.params.id;
  if (!paramId) return next();
  if (req.user?.companyId?.toString() !== paramId.toString()) {
    return next(new AppError("You can only access your own company's data", 403));
  }
  next();
};

/**
 * API key authentication for ERP integrations
 */
const apiKeyAuth = async (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!key) return next(new AppError("API key required", 401));

  const crypto = require("crypto");
  const ApiKey = require("../models/ApiKey");

  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const apiKey  = await ApiKey.findOne({ keyHash, isActive: true }).select("+keyHash");

  if (!apiKey) return next(new AppError("Invalid or revoked API key", 401));
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return next(new AppError("API key has expired", 401));

  apiKey.lastUsedAt = new Date();
  await apiKey.save();

  req.apiKey    = apiKey;
  req.companyId = apiKey.companyId;
  next();
};

module.exports = { requireCompany, restrictToCompanyRole, ownCompanyOnly, apiKeyAuth };
