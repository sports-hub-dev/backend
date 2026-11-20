const mongoose = require("mongoose");
const { productPrice } = require("../utils/currency");

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
// Returns { fullPrice: null, bundlePrice: null } when any product in the
// bundle has no price in that currency (the bundle isn't sold there).
bundleSchema.methods.calculatePrice = async function (currency = "EGP") {
    if (this.products.length > 0 && (!this.products[0].product || this.products[0].product.price === undefined)) {
        await this.populate("products.product", "price prices");
    }
    let fullPrice = 0;
    for (const item of this.products) {
        const unit = productPrice(item.product, currency);
        if (unit === null) return { fullPrice: null, bundlePrice: null };
        fullPrice += unit * item.quantity;
    }
    const bundlePrice = Math.round(fullPrice * (1 - this.discountPercentage / 100));
    return { fullPrice, bundlePrice };
};

module.exports = mongoose.model("Bundle", bundleSchema);