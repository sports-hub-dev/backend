const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title:       "Sports Hub API",
      version:     "2.0.0",
      description: "Sports Hub — B2C + B2B E-Commerce API. Supports individual retail customers, corporate B2B accounts, multi-vendor portal, and ERP integrations.",
      contact: { name: "Sports Hub Dev Team", email: "dev@sportshub.com" },
    },
    servers: [
      { url: "http://localhost:5000/api/v1",      description: "Development" },
      { url: "https://api.sportshub.com/api/v1",  description: "Production" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        ApiKeyAuth:  { type: "apiKey", in: "header", name: "X-API-Key" },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: "Auth",              description: "Authentication & user management" },
      { name: "Products",          description: "Product catalogue" },
      { name: "Orders",            description: "B2C order management" },
      { name: "Promo Codes",       description: "Promotional codes" },
      { name: "Feedback",          description: "Customer feedback" },
      { name: "Settings",          description: "Global platform settings" },
      { name: "Analytics",         description: "Admin analytics & reporting" },
      { name: "Admin",             description: "Platform admin — user management" },
      { name: "B2B Companies",     description: "Corporate account management" },
      { name: "B2B Team",          description: "Company team & invitation management" },
      { name: "B2B Pricing",       description: "Tier pricing & company price overrides" },
      { name: "Purchase Requests", description: "B2B purchase request & approval workflow" },
      { name: "Purchase Orders",   description: "B2B purchase order lifecycle & invoicing" },
      { name: "Vendors",           description: "Multi-vendor portal" },
      { name: "Integrations",      description: "ERP webhooks & API key management" },
      { name: "Health",            description: "Health check & system status" },
    ],
  },
  apis: ["./src/routes/**/*.js", "./src/controllers/**/*.js"],
};

module.exports = swaggerJsdoc(options);
