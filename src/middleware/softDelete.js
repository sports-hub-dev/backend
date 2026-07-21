/**
 * Middleware to automatically exclude soft-deleted products for public routes
 */
const excludeDeleted = (req, res, next) => {
  req.excludeDeleted = true;
  next();
};

/**
 * Middleware to allow admin to see deleted products
 */
const includeDeleted = (req, res, next) => {
  req.excludeDeleted = false;
  next();
};

module.exports = { excludeDeleted, includeDeleted };
