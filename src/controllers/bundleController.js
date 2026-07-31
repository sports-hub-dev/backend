const Bundle = require("../models/Bundle");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { successResponse, paginatedResponse } = require("../utils/apiResponse");

const formatBundle = async (bundle) => {
  const { fullPrice, bundlePrice } = await bundle.calculatePrice();
  const obj = bundle.toObject();
  obj.fullPrice = fullPrice;
  obj.bundlePrice = bundlePrice;
  return obj;
};

exports.getBundles = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const filter = { isDeleted: false, isActive: true };
  const skip = (page - 1) * limit;
  const [bundles, total] = await Promise.all([
    Bundle.find(filter).populate("products.product", "name price mainImage stock hasSizeVariants variants").skip(skip).limit(+limit),
    Bundle.countDocuments(filter),
  ]);
  const formatted = await Promise.all(bundles.map(formatBundle));
  paginatedResponse(res, "Bundles fetched", formatted, page, limit, total);
});

exports.getBundleById = asyncHandler(async (req, res) => {
  const bundle = await Bundle.findById(req.params.id).populate("products.product", "name price mainImage stock hasSizeVariants variants");
  if (!bundle || bundle.isDeleted) throw new AppError("Bundle not found", 404);
  successResponse(res, 200, "Bundle fetched", { bundle: await formatBundle(bundle) });
});

exports.createBundle = asyncHandler(async (req, res) => {
  const products = typeof req.body.products === "string" ? JSON.parse(req.body.products) : req.body.products;
  const bundle = await Bundle.create({
    name: req.body.name,
    description: req.body.description,
    mainImage: req.file?.path,
    products,
    discountPercentage: req.body.discountPercentage,
  });
  successResponse(res, 201, "Bundle created", { bundle: await formatBundle(bundle) });
});

exports.updateBundle = asyncHandler(async (req, res) => {
  const bundle = await Bundle.findById(req.params.id);
  if (!bundle || bundle.isDeleted) throw new AppError("Bundle not found", 404);

  ["name", "description", "discountPercentage", "isActive"].forEach((field) => {
    if (req.body[field] !== undefined) bundle[field] = req.body[field];
  });
  if (req.body.products !== undefined) {
    bundle.products = typeof req.body.products === "string" ? JSON.parse(req.body.products) : req.body.products;
  }
  if (req.file) bundle.mainImage = req.file.path;

  await bundle.save();
  successResponse(res, 200, "Bundle updated", { bundle: await formatBundle(bundle) });
});

exports.deleteBundle = asyncHandler(async (req, res) => {
  const bundle = await Bundle.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
  if (!bundle) throw new AppError("Bundle not found", 404);
  successResponse(res, 200, "Bundle deleted");
});