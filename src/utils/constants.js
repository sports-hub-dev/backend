// ─── Platform Roles ────────────────────────────────────────────────────────
const ROLES = {
  CUSTOMER: "customer",
  ADMIN: "admin",
  VENDOR: "vendor",
};

const PAYMENT_METHODS = {
  APS:              "aps",
};

// ─── Company Roles (B2B) ───────────────────────────────────────────────────
const COMPANY_ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  BUYER: "buyer",
  VIEWER: "viewer",
};

// ─── Pricing Tiers ─────────────────────────────────────────────────────────
const PRICING_TIERS = {
  STANDARD: "standard",
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
  PLATINUM: "platinum",
};

// ─── Order Statuses ────────────────────────────────────────────────────────
const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

// ─── Purchase Request Statuses ─────────────────────────────────────────────
const REQUEST_STATUS = {
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
};

// ─── Purchase Order Statuses ───────────────────────────────────────────────
const PO_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  ACKNOWLEDGED: "acknowledged",
  PROCESSING: "processing",
  FULFILLED: "fulfilled",
  INVOICED: "invoiced",
  PAID: "paid",
  CANCELLED: "cancelled",
};

// ─── Company Statuses ──────────────────────────────────────────────────────
const COMPANY_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
};

// ─── Vendor Statuses ───────────────────────────────────────────────────────
const VENDOR_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  SUSPENDED: "suspended",
  REJECTED: "rejected",
};

// ─── Inventory Change Types ────────────────────────────────────────────────
const INVENTORY_CHANGE_TYPE = {
  MANUAL_INCREASE: "manual_increase",
  MANUAL_DECREASE: "manual_decrease",
  ORDER_PURCHASE: "order_purchase",
  ORDER_CANCELLATION: "order_cancellation",
  PRODUCT_CREATION: "product_creation",
  RESERVATION: "reservation",
  RESERVATION_RELEASE: "reservation_release",
};

// ─── Audit Actions ─────────────────────────────────────────────────────────
const AUDIT_ACTIONS = {
  ORDER_APPROVED: "order.approved",
  ORDER_REJECTED: "order.rejected",
  PRICE_UPDATED: "price.updated",
  USER_INVITED: "user.invited",
  USER_REVOKED: "user.revoked",
  COMPANY_CREATED: "company.created",
  COMPANY_UPDATED: "company.updated",
  PO_CREATED: "po.created",
  PO_STATUS_CHANGED: "po.status_changed",
  VENDOR_APPROVED: "vendor.approved",
  VENDOR_REJECTED: "vendor.rejected",
  SETTING_UPDATED: "setting.updated",
  STOCK_UPDATED: "stock.updated",
};

// ─── Webhook Events ────────────────────────────────────────────────────────
const WEBHOOK_EVENTS = {
  ORDER_CREATED: "order.created",
  ORDER_APPROVED: "order.approved",
  ORDER_STATUS_CHANGED: "order.status_changed",
  ORDER_SHIPPED: "order.shipped",
  ORDER_DELIVERED: "order.delivered",
  INVOICE_ISSUED: "invoice.issued",
  INVOICE_PAID: "invoice.paid",
  STOCK_LOW: "stock.low",
};

// ─── Product Sizes ─────────────────────────────────────────────────────────
const PRODUCT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "ONE_SIZE", "38", "39", "40", "41", "42", "43", "44", "45",];

// ─── Pagination ────────────────────────────────────────────────────────────
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 12,
  MAX_LIMIT: 100,
};

// ─── Currency / Countries ──────────────────────────────────────────────────
const CURRENCY = "EGP";

const COUNTRIES = {
  EGYPT: { code: "EG", currency: "EGP", name: "Egypt" },
  SAUDI_ARABIA: { code: "SA", currency: "SAR", name: "Saudi Arabia" },
  UAE: { code: "AE", currency: "AED", name: "UAE" },
};

module.exports = {
  ROLES, COMPANY_ROLES, PRICING_TIERS,
  ORDER_STATUS, REQUEST_STATUS, PO_STATUS,
  COMPANY_STATUS, VENDOR_STATUS,
  INVENTORY_CHANGE_TYPE, AUDIT_ACTIONS, WEBHOOK_EVENTS,
  PRODUCT_SIZES, PAGINATION, CURRENCY, COUNTRIES,
};
