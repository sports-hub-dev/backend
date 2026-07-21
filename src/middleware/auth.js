const { verifyAccessToken } = require("../utils/jwtUtils");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Protect route: require valid JWT access token
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) throw new AppError("Authentication required. Please log in.", 401);

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === "TokenExpiredError") throw new AppError("Access token expired", 401);
    throw new AppError("Invalid access token", 401);
  }

  const user = await User.findById(decoded.id).select("-password -refreshTokens");
  if (!user) throw new AppError("User no longer exists", 401);
  if (!user.isActive) throw new AppError("Your account has been deactivated", 403);

  req.user = user;
  next();
});

/**
 * Restrict to specific roles
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action", 403));
    }
    next();
  };
};

/**
 * Optional auth: attach user if token present, continue if not
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select("-password -refreshTokens");
    if (user && user.isActive) req.user = user;
  } catch {
    // silently fail - user just won't be attached
  }
  next();
});

module.exports = { protect, restrictTo, optionalAuth };
