const AppError = require("./AppError");

/**
 * Multi-currency support.
 *
 * Each country is sold in its own currency, and each product carries a price
 * per currency that the admin types in by hand (no automatic conversion):
 *   - EGP → product.price         (the original field, unchanged)
 *   - SAR → product.prices.SAR
 *   - AED → product.prices.AED
 * A product with no price in a currency is not sold in that country.
 */
const SUPPORTED_CURRENCIES = ["EGP", "SAR", "AED"];

const COUNTRY_CURRENCY = { EG: "EGP", SA: "SAR", AE: "AED" };

const COUNTRY_NAMES = { EG: "Egypt", SA: "Saudi Arabia", AE: "United Arab Emirates" };

const COUNTRY_ALIASES = {
  eg: "EG", egypt: "EG", "مصر": "EG",
  sa: "SA", ksa: "SA", "saudi arabia": "SA", saudi: "SA", "kingdom of saudi arabia": "SA", "السعودية": "SA",
  ae: "AE", uae: "AE", "united arab emirates": "AE", emirates: "AE", "الإمارات": "AE",
};

/** "Saudi Arabia" / "KSA" / "SA" → "SA". Unknown or empty → "EG" (the original default). */
const normalizeCountry = (value) => {
  if (!value) return "EG";
  return COUNTRY_ALIASES[String(value).trim().toLowerCase()] || "EG";
};

const currencyForCountry = (code) => COUNTRY_CURRENCY[normalizeCountry(code)] || "EGP";

const isSupportedCurrency = (c) => SUPPORTED_CURRENCIES.includes(c);

/** Price of a product in a currency, or null when it isn't sold in that currency. */
const productPrice = (product, currency = "EGP") => {
  if (!product) return null;
  if (currency === "EGP") return typeof product.price === "number" ? product.price : null;
  const value = product.prices ? product.prices[currency] : null;
  return typeof value === "number" && value > 0 ? value : null;
};

/** Settings key holding the flat shipping fee for a currency. EGP keeps the original key. */
const shippingFeeKey = (currency) => (currency === "EGP" ? "shippingFee" : `shippingFee_${currency}`);

/**
 * Works out the order currency from the delivery country, and rejects a
 * client-sent currency that doesn't match it (so nobody can pay EGP prices
 * for a Saudi delivery, or the reverse).
 */
const resolveOrderCurrency = (shippingAddress = {}, requestedCurrency) => {
  const country = normalizeCountry(shippingAddress.country);
  const currency = COUNTRY_CURRENCY[country];
  if (requestedCurrency && requestedCurrency !== currency) {
    throw new AppError(
      `Orders delivered to ${COUNTRY_NAMES[country]} are charged in ${currency}. Switch the site to ${currency} or change the delivery country.`,
      400
    );
  }
  return { country, currency, countryName: COUNTRY_NAMES[country] };
};

module.exports = {
  SUPPORTED_CURRENCIES,
  COUNTRY_CURRENCY,
  COUNTRY_NAMES,
  normalizeCountry,
  currencyForCountry,
  isSupportedCurrency,
  productPrice,
  shippingFeeKey,
  resolveOrderCurrency,
};
