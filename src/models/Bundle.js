const mongoose = require("mongoose");

const bundleItemSchema = new mongoose.Schema(
    {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true, min: 1 }, // how many of this product per bundle sold
    },
    { _id: false }
);

const bundleSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        mainImage: { type: String },
        products: { type: [bundleItemSchema], validate: (v) => v.length >= 2 },
        discountPercentage: { type: Number, required: true, min: 0, max: 100 },
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// Computed at read-time from live product prices, so it never goes stale if a component's price changes later.
bundleSchema.methods.calculatePrice = async function () {
    await this.populate("products.product", "price");
    const fullPrice = this.products.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const bundlePrice = Math.round(fullPrice * (1 - this.discountPercentage / 100));
    return { fullPrice, bundlePrice };
};

module.exports = mongoose.model("Bundle", bundleSchema);