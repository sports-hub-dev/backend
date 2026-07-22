const Product = require("../models/Product");
const InventoryLog = require("../models/InventoryLog");
const inventoryService = require("../services/inventoryService");
const storageService = require("../services/storage/storageService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { successResponse, paginatedResponse } = require("../utils/apiResponse");
const { PAGINATION, INVENTORY_CHANGE_TYPE } = require("../utils/constants");

// ── Admin: Create Product ──────────────────────────────────────────────────
exports.createProduct = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("Main image is required", 400);

  const body = req.body;
  const hasSizeVariants = body.hasSizeVariants === "true" || body.hasSizeVariants === true;
  const isPublic = body.isPublic !== "false" && body.isPublic !== false;
  const vendorId = !isPublic ? (body.vendorId || null) : null;

  let variants = [];
  if (hasSizeVariants) {
    variants = typeof body.variants === "string" ? JSON.parse(body.variants) : body.variants;
  }

  if (!isPublic && !vendorId) {
    throw new AppError("A vendorId is required for vendor-specific (non-public) products", 400);
  }

  const product = await Product.create({
    name: body.name,
    description: body.description,
    price: body.price,
    category: body.category,
    mainImage: req.file.path,
    hasSizeVariants,
    variants: hasSizeVariants ? variants : [],
    stock: hasSizeVariants ? 0 : parseInt(body.stock, 10) || 0,
    isActive: body.isActive !== "false",
    isPublic,
    vendorId,
  });

  if (!hasSizeVariants && product.stock > 0) {
    await InventoryLog.create({
      product: product._id,
      productName: product.name,
      previousStock: 0,
      newStock: product.stock,
      changeAmount: product.stock,
      changeType: INVENTORY_CHANGE_TYPE.PRODUCT_CREATION,
      changedBy: req.user._id,
      changedByName: req.user.fullName,
    });
  }

  successResponse(res, 201, "Product created successfully", { product: formatProduct(product) });
});

// ── Admin: Update Product ──────────────────────────────────────────────────
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product || product.isDeleted) throw new AppError("Product not found", 404);

  const updatableFields = ["name", "description", "price", "category", "isActive", "isPublic", "vendorId"];
  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  });

  // If changing to public, clear vendorId
  if (product.isPublic) product.vendorId = null;

  if (req.file) product.mainImage = req.file.path;
  await product.save();
  successResponse(res, 200, "Product updated successfully", { product: formatProduct(product) });
});

// ── Admin: Soft Delete ─────────────────────────────────────────────────────
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product || product.isDeleted) throw new AppError("Product not found", 404);
  product.isDeleted = true;
  product.deletedAt = new Date();
  product.deletedBy = req.user._id;
  product.isActive = false;
  await product.save();
  successResponse(res, 200, "Product deleted successfully");
});

// ── Admin: Restore ─────────────────────────────────────────────────────────
exports.restoreProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError("Product not found", 404);
  product.isDeleted = false;
  product.deletedAt = null;
  product.deletedBy = null;
  product.isActive = true;
  await product.save();
  successResponse(res, 200, "Product restored successfully", { product: formatProduct(product) });
});

// ── Admin: Upload Additional Images ───────────────────────────────────────
exports.uploadAdditionalImages = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product || product.isDeleted) throw new AppError("Product not found", 404);
  if (!req.files?.length) throw new AppError("No images uploaded", 400);
  product.additionalImages.push(...req.files.map((f) => f.path));
  await product.save();
  successResponse(res, 200, "Images uploaded", {
    additionalImages: product.additionalImages.map((f) => storageService.getFileUrl(f)),
  });
});

// ── Admin: Update Stock ────────────────────────────────────────────────────
exports.updateStock = asyncHandler(async (req, res) => {
  const { newStock, size, notes } = req.body;
  const product = await inventoryService.updateStock({
    productId: req.params.id,
    size,
    newStock: parseInt(newStock, 10),
    adminId: req.user._id,
    adminName: req.user.fullName,
    notes,
  });
  successResponse(res, 200, "Stock updated successfully", { product: formatProduct(product) });
});

// ── Admin: Get All Products (including deleted, all visibility) ────────────
exports.adminGetProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, search, category, isDeleted, isPublic, vendorId } = req.query;
  const filter = {};
  if (isDeleted !== undefined) filter.isDeleted = isDeleted === "true";
  if (isPublic !== undefined) filter.isPublic = isPublic === "true";
  if (vendorId) filter.vendorId = vendorId;
  if (search) filter.$text = { $search: search };
  if (category) filter.category = category;

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit),
    Product.countDocuments(filter),
  ]);
  paginatedResponse(res, "Products fetched", products.map(formatProduct), page, limit, total);
});

// ── Public: Get Products ───────────────────────────────────────────────────
// - Unauthenticated: public products only
// - Authenticated regular customer: public products only
// - Authenticated vendor user: public products + their vendor's products
exports.getProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, search, category, sort, minPrice, maxPrice } = req.query;

  // const vendorId = req.user?.vendorId || null;

  // // Base filter: not deleted, active
  // const filter = { isDeleted: false, isActive: true };

  // // Visibility:
  // // If vendor user → show (isPublic) OR (isPublic=false AND vendorId matches theirs)
  // // Otherwise      → show isPublic only
  // if (vendorId) {
  //   filter.$or = [
  //     { isPublic: true },
  //     { isPublic: false, vendorId },
  //   ];
  // } else {
  //   filter.isPublic = true;
  // }

  // All active products visible to everyone.
  // Order-level enforcement controls who can actually buy vendor-specific products.
  const filter = { isDeleted: false, isActive: true };

  if (search) filter.$text = { $search: search };
  if (category) filter.category = category;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
  }

  const sortMap = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name_asc: { name: 1 },
  };
  const sortBy = sortMap[sort] || { createdAt: -1 };

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sortBy).skip(skip).limit(+limit),
    Product.countDocuments(filter),
  ]);
  paginatedResponse(res, "Products fetched", products.map(formatProduct), page, limit, total);
});

// ── Public: Get Product by ID ──────────────────────────────────────────────
exports.getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false, isActive: true });
  if (!product) throw new AppError("Product not found", 404);

  // const vendorId = req.user?.vendorId || null;

  // // Check visibility
  // if (!product.isPublic) {
  //   // Vendor-specific product
  //   if (!vendorId) throw new AppError("Product not found", 404); // not found for non-vendor users
  //   if (product.vendorId?.toString() !== vendorId.toString()) {
  //     throw new AppError("Product not found", 404); // wrong vendor
  //   }
  // }


  successResponse(res, 200, "Product fetched", { product: formatProduct(product) });
});

// ── Get Inventory Logs (Admin) ─────────────────────────────────────────────
exports.getInventoryLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, productId } = req.query;
  const filter = productId ? { product: productId } : {};
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    InventoryLog.find(filter).populate("product", "name").sort({ createdAt: -1 }).skip(skip).limit(+limit),
    InventoryLog.countDocuments(filter),
  ]);
  paginatedResponse(res, "Inventory logs fetched", logs, page, limit, total);
});

// ── Format product with full image URLs ────────────────────────────────────
const formatProduct = (product) => {
  const obj = product.toObject({ virtuals: true });
  obj.mainImage = storageService.getFileUrl(obj.mainImage);
  obj.additionalImages = (obj.additionalImages || []).map((img) => storageService.getFileUrl(img));
  return obj;
};
