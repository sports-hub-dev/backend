const mongoose = require("mongoose");
const { INVENTORY_CHANGE_TYPE } = require("../utils/constants");

const inventoryLogSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productName: { type: String },
    sizeVariant: { type: String }, // null for single-size products
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    changeAmount: { type: Number, required: true }, // positive = increase, negative = decrease
    changeType: {
      type: String,
      required: true,
      enum: Object.values(INVENTORY_CHANGE_TYPE),
    },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedByName: { type: String },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    notes: { type: String },
  },
  { timestamps: true }
);

inventoryLogSchema.index({ createdAt: -1 });
inventoryLogSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryLog", inventoryLogSchema);
