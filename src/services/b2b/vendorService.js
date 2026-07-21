const Vendor    = require("../../models/Vendor");
const User      = require("../../models/User");
const AuditLog  = require("../../models/AuditLog");
const AppError  = require("../../utils/AppError");
const { sendEmail } = require("../../utils/emailUtils");
const { VENDOR_STATUS, ROLES } = require("../../utils/constants");

const vendorService = {

  async applyAsVendor(data) {
    const existing = await Vendor.findOne({ email: data.email });
    if (existing) throw new AppError("A vendor with this email already exists", 409);

    const vendor = await Vendor.create({ ...data, status: VENDOR_STATUS.PENDING, isActive: false });
    return vendor;
  },

  async approveVendor(vendorId, adminId) {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) throw new AppError("Vendor not found", 404);

    vendor.status     = VENDOR_STATUS.APPROVED;
    vendor.isActive   = true;
    vendor.approvedBy = adminId;
    vendor.approvedAt = new Date();
    await vendor.save();

    // Create vendor user account if not already linked
    if (!vendor.userId) {
      const tempPass = Math.random().toString(36).slice(-10) + "A1!";
      const user = await User.create({
        firstName: vendor.name.split(" ")[0] || vendor.name,
        lastName:  vendor.name.split(" ").slice(1).join(" ") || "Vendor",
        email:     vendor.email,
        password:  tempPass,
        role:      ROLES.VENDOR,
        vendorId:  vendor._id,
        isActive:  true,
      });
      vendor.userId = user._id;
      await vendor.save();

      await sendEmail({
        to: vendor.email,
        subject: "Sports Hub — Your vendor account has been approved",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
          <h2 style="color:#1B2A4A;">Welcome to Sports Hub Vendors!</h2>
          <p>Your vendor application for <strong>${vendor.name}</strong> has been approved.</p>
          <p>Login email: <strong>${vendor.email}</strong><br/>Temporary password: <strong>${tempPass}</strong></p>
          <p>Please log in and change your password immediately.</p>
        </div>`,
      });
    }

    await AuditLog.create({ userId: adminId, action: "vendor.approved", resourceType: "Vendor", resourceId: vendor._id });
    return vendor;
  },

  async rejectVendor(vendorId, adminId, reason) {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) throw new AppError("Vendor not found", 404);

    vendor.status          = VENDOR_STATUS.REJECTED;
    vendor.rejectionReason = reason;
    await vendor.save();

    await AuditLog.create({ userId: adminId, action: "vendor.rejected", resourceType: "Vendor", resourceId: vendor._id, notes: reason });
    return vendor;
  },

  async getVendorDashboard(vendorId) {
    const Order = require("../../models/Order");
    const Product = require("../../models/Product");

    const [productCount, vendor] = await Promise.all([
      Product.countDocuments({ vendorId, isDeleted: false }),
      Vendor.findById(vendorId),
    ]);

    return {
      vendor: { name: vendor.name, status: vendor.status, commissionRate: vendor.commissionRate },
      productCount,
      totalSales:   vendor.totalSales,
      totalPayouts: vendor.totalPayouts,
    };
  },
};

module.exports = vendorService;
