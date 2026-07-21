const Product      = require("../models/Product");
const InventoryLog = require("../models/InventoryLog");
const AppError     = require("../utils/AppError");
const logger       = require("../utils/logger");
const { INVENTORY_CHANGE_TYPE } = require("../utils/constants");

// Lazy-load to avoid circular dependency
const getOdooSync = () => require("./odoo/odooSyncService");

const inventoryService = {

  /**
   * Deduct stock for order items (within a MongoDB session).
   * After each deduction, triggers an async Odoo outbound sync.
   */
  async deductStockForOrder(items, session, orderId = null) {
    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) throw new AppError(`Product not found: ${item.product}`, 404);

      let newStock;

      if (product.hasSizeVariants) {
        const variant = product.variants.id(item.variantId || null) ||
          product.variants.find(v => v.size === item.size);
        if (!variant) throw new AppError(`Size ${item.size} not found for ${product.name}`, 400);
        if (variant.stock < item.quantity) {
          throw new AppError(`Insufficient stock for ${product.name} — Size ${item.size}`, 400);
        }
        const prevStock = variant.stock;
        variant.stock  -= item.quantity;
        newStock        = variant.stock;
        await product.save({ session });

        await InventoryLog.create([{
          product:       product._id,
          productName:   product.name,
          sizeVariant:   item.size,
          previousStock: prevStock,
          newStock,
          changeAmount:  -item.quantity,
          changeType:    INVENTORY_CHANGE_TYPE.ORDER_PURCHASE,
          relatedOrder:  orderId,
        }], { session });

        // Fire-and-forget Odoo sync (non-blocking — order must not fail due to Odoo being down)
        setImmediate(() => {
          getOdooSync().syncStockToOdoo({
            productId:   product._id,
            size:        item.size,
            newStock,
            triggerType: "order_placed",
            relatedOrderId: orderId,
          }).catch(err => logger.error(`Odoo sync error (order deduct): ${err.message}`));
        });
      } else {
        if (product.stock < item.quantity) {
          throw new AppError(`Insufficient stock for ${product.name}`, 400);
        }
        const prevStock = product.stock;
        product.stock  -= item.quantity;
        newStock        = product.stock;
        await product.save({ session });

        await InventoryLog.create([{
          product:       product._id,
          productName:   product.name,
          previousStock: prevStock,
          newStock,
          changeAmount:  -item.quantity,
          changeType:    INVENTORY_CHANGE_TYPE.ORDER_PURCHASE,
          relatedOrder:  orderId,
        }], { session });

        setImmediate(() => {
          getOdooSync().syncStockToOdoo({
            productId:   product._id,
            size:        null,
            newStock,
            triggerType: "order_placed",
            relatedOrderId: orderId,
          }).catch(err => logger.error(`Odoo sync error (order deduct): ${err.message}`));
        });
      }
    }
  },

  /**
   * Restore stock when an order is cancelled.
   */
  async restoreStockForOrder(items, session, orderId = null) {
    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) continue;

      let newStock;

      if (product.hasSizeVariants && item.size) {
        const variant = product.variants.find(v => v.size === item.size);
        if (!variant) continue;
        const prevStock = variant.stock;
        variant.stock  += item.quantity;
        newStock        = variant.stock;
        await product.save({ session });

        await InventoryLog.create([{
          product:       product._id,
          productName:   product.name,
          sizeVariant:   item.size,
          previousStock: prevStock,
          newStock,
          changeAmount:  item.quantity,
          changeType:    INVENTORY_CHANGE_TYPE.ORDER_CANCELLATION,
          relatedOrder:  orderId,
        }], { session });

        setImmediate(() => {
          getOdooSync().syncStockToOdoo({
            productId:   product._id,
            size:        item.size,
            newStock,
            triggerType: "order_cancelled",
            relatedOrderId: orderId,
          }).catch(err => logger.error(`Odoo sync error (order restore): ${err.message}`));
        });
      } else {
        const prevStock = product.stock;
        product.stock  += item.quantity;
        newStock        = product.stock;
        await product.save({ session });

        await InventoryLog.create([{
          product:       product._id,
          productName:   product.name,
          previousStock: prevStock,
          newStock,
          changeAmount:  item.quantity,
          changeType:    INVENTORY_CHANGE_TYPE.ORDER_CANCELLATION,
          relatedOrder:  orderId,
        }], { session });

        setImmediate(() => {
          getOdooSync().syncStockToOdoo({
            productId:   product._id,
            size:        null,
            newStock,
            triggerType: "order_cancelled",
            relatedOrderId: orderId,
          }).catch(err => logger.error(`Odoo sync error (order restore): ${err.message}`));
        });
      }
    }
  },

  /**
   * Manual stock update by admin — also syncs to Odoo.
   */
  async updateStock({ productId, size, newStock, changeType, adminId, adminName, notes }, session = null) {
    const product = await Product.findById(productId).session(session);
    if (!product) throw new AppError("Product not found", 404);

    let prevStock;
    if (product.hasSizeVariants && size) {
      const variant = product.variants.find(v => v.size === size);
      if (!variant) throw new AppError(`Size ${size} not found`, 400);
      prevStock     = variant.stock;
      variant.stock = newStock;
    } else {
      prevStock     = product.stock;
      product.stock = newStock;
    }

    await product.save({ session });

    await InventoryLog.create([{
      product:       product._id,
      productName:   product.name,
      sizeVariant:   size || null,
      previousStock: prevStock,
      newStock,
      changeAmount:  newStock - prevStock,
      changeType:    changeType || (newStock > prevStock
        ? INVENTORY_CHANGE_TYPE.MANUAL_INCREASE
        : INVENTORY_CHANGE_TYPE.MANUAL_DECREASE),
      changedBy:     adminId,
      changedByName: adminName,
      notes,
    }], { session });

    setImmediate(() => {
      getOdooSync().syncStockToOdoo({
        productId,
        size:        size || null,
        newStock,
        triggerType: "manual_stock_update",
      }).catch(err => logger.error(`Odoo sync error (manual update): ${err.message}`));
    });

    return product;
  },
};

module.exports = inventoryService;
