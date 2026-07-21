const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const InventoryLog = require("../models/InventoryLog");
const PromoCode = require("../models/PromoCode");
const { ORDER_STATUS } = require("../utils/constants");

const analyticsService = {
  async getDateRangeAnalytics(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const [summary] = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $ne: ORDER_STATUS.CANCELLED },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$total" },
          totalProductsSold: { $sum: { $sum: "$items.quantity" } },
          avgOrderValue: { $avg: "$total" },
        },
      },
    ]);

    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $ne: ORDER_STATUS.CANCELLED },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          totalQuantity: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    return {
      period: { startDate: start, endDate: end },
      summary: summary || { totalOrders: 0, totalRevenue: 0, totalProductsSold: 0, avgOrderValue: 0 },
      topProducts,
    };
  },

  async getProductAnalytics(productId) {
    const id = new mongoose.Types.ObjectId(productId);
    const [result] = await Order.aggregate([
      { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $unwind: "$items" },
      { $match: { "items.product": id } },
      {
        $group: {
          _id: "$items.product",
          totalQuantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          orderCount: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          totalQuantitySold: 1,
          revenue: 1,
          orderCount: { $size: "$orderCount" },
        },
      },
    ]);
    return result || { totalQuantitySold: 0, revenue: 0, orderCount: 0 };
  },

  async getRevenueByPeriod(period = "daily", limit = 30) {
    let dateGroup;
    if (period === "daily") dateGroup = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } };
    else if (period === "weekly") dateGroup = { year: { $year: "$createdAt" }, week: { $week: "$createdAt" } };
    else dateGroup = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };

    return Order.aggregate([
      { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $group: { _id: dateGroup, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
      { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
      { $limit: limit },
    ]);
  },

  async getLowStockProducts(threshold = 5) {
    return Product.aggregate([
      { $match: { isDeleted: false, isActive: true } },
      {
        $project: {
          name: 1,
          hasSizeVariants: 1,
          stock: 1,
          variants: 1,
          effectiveStock: {
            $cond: {
              if: "$hasSizeVariants",
              then: { $sum: "$variants.stock" },
              else: "$stock",
            },
          },
        },
      },
      { $match: { effectiveStock: { $lte: threshold } } },
      { $sort: { effectiveStock: 1 } },
    ]);
  },

  async getOrderStatusBreakdown() {
    return Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  },

  async getPromoCodeUsage() {
    return PromoCode.aggregate([
      {
        $project: {
          code: 1,
          discountPercentage: 1,
          usageCount: 1,
          usageLimit: 1,
          isActive: 1,
          utilizationRate: {
            $cond: {
              if: { $gt: ["$usageLimit", 0] },
              then: { $multiply: [{ $divide: ["$usageCount", "$usageLimit"] }, 100] },
              else: null,
            },
          },
        },
      },
      { $sort: { usageCount: -1 } },
    ]);
  },

  async getCustomerRegistrationAnalytics(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return User.aggregate([
      { $match: { createdAt: { $gte: since }, role: "customer" } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
    ]);
  },
};

module.exports = analyticsService;
