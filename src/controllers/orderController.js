const mongoose       = require("mongoose");
const Order          = require("../models/Order");
const Product        = require("../models/Product");
const orderService   = require("../services/orderService");
const asyncHandler   = require("../utils/asyncHandler");
const storageService   = require("../services/storage/storageService");
const AppError       = require("../utils/AppError");
const { successResponse, paginatedResponse } = require("../utils/apiResponse");
const { PAGINATION } = require("../utils/constants");

// ── Create Order — requires login (no guest orders for vendor products) ────
// Public products can be ordered by any logged-in user.
// Vendor-specific products can only be ordered by approved users of that vendor.
exports.createOrder = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, customerInfo, shippingAddress, promoCode } = req.body;

    const userVendorId = req.user?.vendorId?.toString() || null;

    // Enrich items and validate visibility + access
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.product).session(session);
        const obj = product.toObject({ virtuals: true });
        if (!product || product.isDeleted || !product.isActive) {
          throw new AppError(`Product ${item.product} is not available`, 400);
        }

        // Visibility check: vendor-specific products only for that vendor's users
        if (!product.isPublic) {
          if (!userVendorId) {
            throw new AppError(`Product "${product.name}" is not available`, 403);
          }
          if (product.vendorId?.toString() !== userVendorId) {
            throw new AppError(`Product "${product.name}" is not available`, 403);
          }
        }

        return {
          product:   product._id,
          name:      product.name,
          mainImage: storageService.getFileUrl(obj.mainImage),
          size:      item.size || null,
          quantity:  item.quantity,
          price:     product.price,
        };
      })
    );

    // Determine if this order is vendor-scoped:
    // If ALL items are from the same vendor, tag the order with that vendorId.
    // If mixed (public + vendor or multiple vendors), vendorId stays null.
    let orderVendorId = null;
    const vendorIds = [...new Set(
      enrichedItems
        .map(async (_, i) => {
          const p = await Product.findById(items[i].product);
          return p?.vendorId?.toString() || null;
        })
    )];
    // Simple approach: tag with user's vendorId if they are a vendor user
    if (userVendorId) orderVendorId = req.user.vendorId;

    const order = await orderService.createOrder(
      {
        items:           enrichedItems,
        customerInfo,
        shippingAddress,
        promoCode,
        userId:          req.user._id,
        isGuest:         false,
        vendorId:        orderVendorId,
      },
      session
    );

    await session.commitTransaction();
    session.endSession();
    successResponse(res, 201, "Order placed successfully", { order });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// ── Admin: Get All Orders ──────────────────────────────────────────────────
// Supports ?vendorId= to filter vendor-specific orders
exports.getAllOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, status, search, vendorId } = req.query;

  const filter = {};
  if (status)   filter.status   = status;
  if (vendorId) filter.vendorId = vendorId;
  if (search) {
    filter.$or = [
      { orderNumber:          { $regex: search, $options: "i" } },
      { "customerInfo.name":  { $regex: search, $options: "i" } },
      { "customerInfo.email": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(+limit)
      .populate("user", "firstName lastName email")
      .populate("vendorId", "name"),
    Order.countDocuments(filter),
  ]);
  paginatedResponse(res, "Orders fetched", orders, page, limit, total);
});

// ── Admin: Get Order by ID ─────────────────────────────────────────────────
exports.getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "firstName lastName email")
    .populate("vendorId", "name");
  if (!order) throw new AppError("Order not found", 404);
  successResponse(res, 200, "Order fetched", { order });
});

// ── Admin: Update Order Status ─────────────────────────────────────────────
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await orderService.updateOrderStatus(
      req.params.id,
      req.body.status,
      req.user._id,
      req.user.fullName,
      req.body.notes,
      session
    );
    await session.commitTransaction();
    session.endSession();
    successResponse(res, 200, "Order status updated", { order });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// ── User: My Orders ────────────────────────────────────────────────────────
exports.getMyOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = { user: req.user._id };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit),
    Order.countDocuments(filter),
  ]);
  paginatedResponse(res, "Your orders fetched", orders, page, limit, total);
});

// ── User: My Order by ID ───────────────────────────────────────────────────
exports.getMyOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new AppError("Order not found", 404);
  successResponse(res, 200, "Order fetched", { order });
});

// ── Public: Track by order number ──────────────────────────────────────────
exports.trackOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber.toUpperCase() })
    .select("orderNumber status timeline customerInfo.name shippingAddress createdAt total");
  if (!order) throw new AppError("Order not found", 404);
  successResponse(res, 200, "Order tracked", { order });
});
