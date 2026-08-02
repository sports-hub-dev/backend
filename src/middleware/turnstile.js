const axios    = require("axios");
const AppError = require("../utils/AppError");

const verifyTurnstile = async (req, res, next) => {
  // Skip in test/dev if no secret configured
  if (!process.env.TURNSTILE_SECRET_KEY) return next();

  const token = req.body.turnstileToken;
  if (!token) return next(new AppError("Bot verification required", 400));

  try {
    const { data } = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({
        secret:   process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: req.ip,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    if (!data.success) return next(new AppError("Bot verification failed. Please try again.", 403));
    next();
  } catch {
    next(new AppError("Could not verify bot check. Please try again.", 502));
  }
};

module.exports = verifyTurnstile;