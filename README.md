# 🏆 Sports Hub Backend API — v2.0

Production-ready Node.js/Express/MongoDB backend covering:
- **B2C** retail e-commerce (Amazon uniforms, Egypt)
- **B2B** corporate portal with approval workflows, purchase orders, and invoicing
- **Multi-vendor** marketplace support
- **ERP integration** via webhooks and API keys

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (Express 5) |
| Database | MongoDB 7 + Mongoose |
| Auth | JWT access + refresh tokens, API keys for ERP |
| Validation | express-validator |
| Security | Helmet, CORS, rate limiting, HMAC webhook signing |
| Uploads | Multer (local → S3/Cloudinary ready) |
| Email | Nodemailer |
| Logging | Winston |
| Docs | Swagger / OpenAPI 3.0 |
| Testing | Jest + Supertest |
| DevOps | Docker + docker-compose |

---

## 📁 Folder Structure

```
src/
├── config/           database, jwt, mail, server, storage, swagger
├── controllers/
│   ├── (B2C)         authController, productController, orderController ...
│   └── b2b/          companyController, purchaseRequestController,
│                     purchaseOrderController, vendorController, webhookController
├── middleware/
│   ├── (core)        auth, errorHandler, rateLimiter, upload, validate, softDelete
│   └── b2bAuth.js    requireCompany, restrictToCompanyRole, ownCompanyOnly, apiKeyAuth
├── models/
│   ├── (B2C)         User, Product, Order, PromoCode, Feedback, InventoryLog, Settings
│   └── (B2B)         Company, PricingTier, CompanyPrice, PurchaseRequest,
│                     PurchaseOrder, Vendor, Invoice, AuditLog, WebhookConfig, ApiKey
├── routes/
│   ├── (B2C)         authRoutes, productRoutes, orderRoutes, index.js
│   └── b2b/          companyRoutes, purchaseRequestRoutes, purchaseOrderRoutes,
│                     vendorRoutes, webhookRoutes
├── services/
│   ├── (B2C)         authService, orderService, inventoryService, analyticsService
│   ├── b2b/          companyService, purchaseRequestService, vendorService, webhookService
│   └── storage/      storageService, localStorageProvider
├── utils/            AppError, asyncHandler, apiResponse, jwtUtils, emailUtils,
│                     constants, logger
├── validations/      authValidation, productValidation, orderValidation,
│                     promoFeedbackValidation
├── uploads/products/ uploaded images
├── logs/             winston log files
├── app.js
└── server.js
```

---

## ⚙️ Setup

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secrets, SMTP settings
```

### 3. Run

```bash
npm run dev       # development with nodemon
npm start         # production
```

### 4. Docker

```bash
docker-compose up -d
```

---

## 🔑 First Admin Setup

```bash
# Register via POST /api/v1/auth/register, then:
mongosh sportshub
db.users.updateOne({ email: "admin@sportshub.com" }, { $set: { role: "admin" } })
```

---

## 🌐 API Reference

Base URL: `http://localhost:5000/api/v1`
Swagger UI: `http://localhost:5000/api/docs`
Health: `http://localhost:5000/health`

---

### 🔐 Auth  `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register new user |
| POST | `/auth/login` | ❌ | Login → access + refresh token |
| POST | `/auth/logout` | ✅ | Logout, invalidate refresh token |
| POST | `/auth/refresh-token` | ❌ | Rotate tokens |
| POST | `/auth/forgot-password` | ❌ | Send reset email |
| POST | `/auth/reset-password/:token` | ❌ | Reset password |
| GET | `/auth/me` | ✅ | Get own profile |
| PATCH | `/auth/me` | ✅ | Update profile |
| POST | `/auth/me/addresses` | ✅ | Add address |
| PATCH | `/auth/me/addresses/:id` | ✅ | Update address |
| DELETE | `/auth/me/addresses/:id` | ✅ | Delete address |

---

### 📦 Products  `/products`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | ❌ | List products (paginated, filtered) |
| GET | `/products/:id` | ❌ | Get product |
| GET | `/products/admin/all` | 🔑 Admin | All products incl. deleted |
| POST | `/products` | 🔑 Admin | Create (multipart/form-data + mainImage) |
| PATCH | `/products/:id` | 🔑 Admin | Update |
| DELETE | `/products/:id` | 🔑 Admin | Soft delete |
| PATCH | `/products/:id/restore` | 🔑 Admin | Restore |
| POST | `/products/:id/images` | 🔑 Admin | Upload additional images |
| PATCH | `/products/:id/stock` | 🔑 Admin | Update stock |
| GET | `/products/admin/inventory-logs` | 🔑 Admin | Inventory history |

**Query params:** `?page=1&limit=12&search=polo&category=shirts&sort=price_asc&minPrice=100&maxPrice=500`

---

### 🛒 Orders  `/orders`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | ❌ (optional) | Place B2C order (guest or registered) |
| GET | `/orders/track/:orderNumber` | ❌ | Track by order number |
| GET | `/orders/my-orders` | ✅ | Own orders |
| GET | `/orders/my-orders/:id` | ✅ | Own order detail |
| GET | `/orders` | 🔑 Admin | All orders |
| GET | `/orders/:id` | 🔑 Admin | Order detail |
| PATCH | `/orders/:id/status` | 🔑 Admin | Update status |

**Order statuses:** `pending → confirmed → processing → shipped → delivered → cancelled`

---

### 🎟️ Promo Codes  `/promo-codes`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/promo-codes/validate` | ❌ | Validate a code |
| GET | `/promo-codes` | 🔑 Admin | List all |
| POST | `/promo-codes` | 🔑 Admin | Create |
| PATCH | `/promo-codes/:id` | 🔑 Admin | Update |
| DELETE | `/promo-codes/:id` | 🔑 Admin | Delete |
| PATCH | `/promo-codes/:id/toggle` | 🔑 Admin | Toggle active |

---

### 💬 Feedback  `/feedback`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/feedback` | ❌ | Submit feedback |
| GET | `/feedback` | 🔑 Admin | View all |
| DELETE | `/feedback/:id` | 🔑 Admin | Delete |

---

### ⚙️ Settings  `/settings`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/settings/shipping-fee` | ❌ | Current shipping fee |
| GET | `/settings` | 🔑 Admin | All settings |
| POST | `/settings` | 🔑 Admin | Upsert setting |

**Set shipping fee body:** `{ "key": "shippingFee", "value": 75 }`

---

### 📊 Analytics  `/analytics`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/analytics/date-range?startDate=&endDate=` | 🔑 Admin | Revenue, orders, top products |
| GET | `/analytics/revenue?period=daily&limit=30` | 🔑 Admin | Revenue by period |
| GET | `/analytics/low-stock?threshold=5` | 🔑 Admin | Low stock products |
| GET | `/analytics/order-status` | 🔑 Admin | Order status breakdown |
| GET | `/analytics/promo-usage` | 🔑 Admin | Promo code stats |
| GET | `/analytics/customers?days=30` | 🔑 Admin | Registrations over time |
| GET | `/analytics/products/:productId` | 🔑 Admin | Single product analytics |

---

### 👥 Admin — Users  `/admin`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List all users |
| GET | `/admin/users/:id` | User detail |
| PATCH | `/admin/users/:id/toggle-status` | Activate / deactivate |

---

---

## 🏢 B2B API Reference

---

### 🏢 Companies  `/b2b/companies`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/b2b/companies` | 🔑 Admin | Create company |
| GET | `/b2b/companies` | 🔑 Admin | List all companies |
| GET | `/b2b/companies/:id` | 🔑 | Get company |
| PATCH | `/b2b/companies/:id` | 🔑 | Update company |
| PATCH | `/b2b/companies/:id/approve` | 🔑 Admin | Approve company |
| PATCH | `/b2b/companies/:id/suspend` | 🔑 Admin | Suspend company |
| GET | `/b2b/companies/audit-logs` | 🔑 Admin | Full audit trail |

**Team Management:**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/b2b/companies/:companyId/invite` | 🔑 Owner/Manager | Invite employee by email |
| GET | `/b2b/companies/:companyId/team` | 🔑 Company | List team members |
| PATCH | `/b2b/companies/:companyId/team/:userId/role` | 🔑 Owner | Change member's role |
| DELETE | `/b2b/companies/:companyId/team/:userId` | 🔑 Owner | Revoke access |
| POST | `/b2b/companies/invitations/:token/accept` | ❌ | Accept invitation & set password |

**Pricing:**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/b2b/companies/pricing-tiers` | 🔑 Admin | List pricing tiers |
| POST | `/b2b/companies/pricing-tiers` | 🔑 Admin | Create/update tier |
| PATCH | `/b2b/companies/:companyId/pricing-tier` | 🔑 Admin | Assign tier to company |
| POST | `/b2b/companies/:companyId/price-overrides` | 🔑 Admin | Set per-product price for company |
| GET | `/b2b/companies/price/resolve?productId=&quantity=` | 🔑 B2B user | Resolve my company's price |

**Company Roles:** `owner` → `manager` → `buyer` → `viewer`

**Pricing Tiers (seeded on startup):**

| Tier | Discount | Payment Terms | Min Monthly Spend |
|------|----------|---------------|-------------------|
| Standard | 0% | Cash | — |
| Bronze | 5% | Net 15 | 5,000 EGP |
| Silver | 10% | Net 30 | 20,000 EGP |
| Gold | 18% | Net 60 | 50,000 EGP |
| Platinum | 25% | Net 90 | Negotiated |

**Price Resolution Priority:**
1. Company-specific price override (highest)
2. Pricing tier discount
3. Standard retail price (RRP)

---

### 📋 Purchase Requests  `/b2b/purchase-requests`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/b2b/purchase-requests` | 🔑 B2B Buyer+ | Create draft request |
| POST | `/b2b/purchase-requests/:id/submit` | 🔑 B2B Buyer+ | Submit for approval |
| POST | `/b2b/purchase-requests/:id/approve` | 🔑 Manager/Owner | Approve request |
| POST | `/b2b/purchase-requests/:id/reject` | 🔑 Manager/Owner | Reject with reason |
| POST | `/b2b/purchase-requests/:id/cancel` | 🔑 Requestor | Cancel draft/pending |
| POST | `/b2b/purchase-requests/:id/convert-to-po` | 🔑 Admin | Convert approved request to PO |
| GET | `/b2b/purchase-requests/my` | 🔑 B2B user | My own requests |
| GET | `/b2b/purchase-requests/company` | 🔑 Manager+ | All company requests |
| GET | `/b2b/purchase-requests/:id` | 🔑 | Request detail |

**Request Statuses:** `draft → pending_approval → approved → rejected / cancelled / expired`

**Approval Workflow:**
- Orders below `autoApproveBelow` threshold: auto-approved instantly
- Orders above `stage1Threshold`: require Manager/Owner approval
- Orders above `stage2Threshold` (if set): require two-stage approval (Manager + Owner)

**Create Request Body:**
```json
{
  "items": [
    { "productId": "PRODUCT_ID", "name": "Amazon Polo", "size": "L", "quantity": 10 }
  ],
  "notes": "For Q1 warehouse team"
}
```

---

### 📄 Purchase Orders  `/b2b/purchase-orders`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/b2b/purchase-orders` | 🔑 | List POs (company-scoped) |
| GET | `/b2b/purchase-orders/:id` | 🔑 | PO detail |
| PATCH | `/b2b/purchase-orders/:id/status` | 🔑 Admin | Update PO status |
| POST | `/b2b/purchase-orders/:id/generate-invoice` | 🔑 Admin | Generate invoice |
| POST | `/b2b/purchase-orders/:id/mark-paid` | 🔑 Admin | Record payment |

**PO Statuses:** `submitted → acknowledged → processing → fulfilled → invoiced → paid`

**Update Status Body:**
```json
{
  "status": "fulfilled",
  "trackingNumber": "BOS123456",
  "carrier": "Bosta",
  "notes": "Shipped from Cairo warehouse"
}
```

**Generate Invoice Body:**
```json
{ "vatRate": 14 }
```

---

### 🏪 Vendors  `/vendors`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/vendors/apply` | ❌ | Submit vendor application |
| GET | `/vendors/me/dashboard` | 🔑 Vendor | Own dashboard stats |
| GET | `/vendors/me/products` | 🔑 Vendor | Own products |
| GET | `/vendors` | 🔑 Admin | All vendors |
| GET | `/vendors/:id` | 🔑 | Vendor detail |
| GET | `/vendors/:id/dashboard` | 🔑 | Vendor dashboard |
| GET | `/vendors/:id/products` | 🔑 | Vendor products |
| PATCH | `/vendors/:id/approve` | 🔑 Admin | Approve vendor |
| PATCH | `/vendors/:id/reject` | 🔑 Admin | Reject vendor |
| PATCH | `/vendors/:id` | 🔑 Admin | Update vendor |

**Vendor Application Body:**
```json
{
  "name": "Cairo Uniforms Co.",
  "email": "info@cairouniforms.com",
  "phone": "+201001234567",
  "description": "Wholesale uniform supplier since 2010",
  "address": { "city": "Cairo", "area": "Heliopolis", "street": "Al Nozha St" },
  "commissionRate": 10
}
```

---

### 🔌 Integrations  `/integrations`

**Webhooks (outbound to ERP):**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/integrations` | 🔑 Company | Register webhook URL |
| GET | `/integrations` | 🔑 Company | List webhooks |
| PATCH | `/integrations/:id/toggle` | 🔑 Company | Enable/disable |
| DELETE | `/integrations/:id` | 🔑 Company | Remove webhook |

**API Keys (for ERP pull access):**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/integrations/api-keys` | 🔑 Company | Create API key |
| GET | `/integrations/api-keys` | 🔑 Company | List keys |
| DELETE | `/integrations/api-keys/:id` | 🔑 Company | Revoke key |

**ERP Inbound (push from ERP to Sports Hub):**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/integrations/erp/inbound` | `X-API-Key` | ERP pushes events in |

**Webhook Events fired by Sports Hub:**
- `order.created`, `order.approved`, `order.status_changed`
- `order.shipped`, `order.delivered`
- `invoice.issued`, `invoice.paid`
- `stock.low`

**Webhook payload signed with HMAC-SHA256 — verify with:**
```
X-SportHub-Signature: sha256=<hmac>
```

---

## 🔒 Authentication Guide

### B2C (retail customers)
```
POST /auth/register → POST /auth/login → Authorization: Bearer <accessToken>
```

### B2B (corporate users)
```
POST /auth/login → JWT contains: { id, role, companyId, companyRole, tier }
→ All B2B routes automatically scope data to companyId
```

### ERP Integration
```
POST /integrations/api-keys → get key (shown once)
→ All ERP requests: X-API-Key: shk_live_xxxxxxxx
```

---

## 🧪 Testing

```bash
npm test                 # all tests
npm run test:unit        # unit only
npm run test:integration # integration only
```

---

## 🚀 Deployment

```bash
# Docker
docker-compose up -d --build

# PM2
npm install -g pm2
pm2 start src/server.js --name sportshub-api
pm2 save && pm2 startup
```

---

## 📊 Database Collections

| Collection | Purpose |
|---|---|
| `users` | All platform users (B2C customers, B2B employees, admins, vendors) |
| `companies` | Corporate B2B accounts |
| `pricingtiers` | Standard/Bronze/Silver/Gold/Platinum tier configs |
| `companyprices` | Per-company product price overrides |
| `products` | Product catalogue with variant/size support |
| `orders` | B2C orders (guest + registered) |
| `purchaserequests` | B2B purchase requests with approval workflow |
| `purchaseorders` | Formal PO documents linked to approved requests |
| `invoices` | Tax invoices linked to POs |
| `vendors` | Vendor profiles and applications |
| `promocodes` | Promotional discount codes |
| `feedbacks` | Customer feedback |
| `inventorylogs` | Full stock change audit trail |
| `auditlogs` | B2B action audit trail |
| `webhookconfigs` | Outbound webhook registrations per company |
| `apikeys` | ERP API key records (hashed) |
| `settings` | Global settings (shipping fee, etc.) |

---

## 🌍 Multi-Country Readiness

Designed for future expansion to Saudi Arabia and UAE:
- `User.country` stores ISO country code
- `Order.currency` stored per order
- `Company.currency` and `Company.country` per company
- `Settings` supports country-specific keys (`shippingFee_SA`, `shippingFee_AE`)
- Storage service abstracted — swap to S3 with one config change
