const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const { ROLES, COMPANY_ROLES } = require("../utils/constants");

const addressSchema = new mongoose.Schema(
  {
    fullName:    { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    country:     { type: String, required: true, default: "Egypt" },
    city:        { type: String, required: true, trim: true },
    area:        { type: String, required: true, trim: true },
    street:      { type: String, required: true, trim: true },
    building:    { type: String, trim: true },
    floor:       { type: String, trim: true },
    apartment:   { type: String, trim: true },
    notes:       { type: String, trim: true },
    isDefault:   { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    firstName:   { type: String, required: true, trim: true },
    lastName:    { type: String, required: true, trim: true },
    email:       { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phoneNumber: { type: String, trim: true, index: true },
    password:    { type: String, required: true, select: false, minlength: 8 },

    // Platform role
    role: {
      type:    String,
      enum:    Object.values(ROLES),
      default: ROLES.CUSTOMER,
    },

    // ── Vendor user link ──────────────────────────────────────────────────
    // When a user registers as a vendor user, vendorId links them to the
    // vendor company. isApproved starts false until admin approves them.
    vendorId:   { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", index: true, default: null },
    isApproved: { type: Boolean, default: true },  // false for vendor users until admin approves
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },

    // ── B2B company link (kept for future extensibility) ──────────────────
    companyId:   { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true, default: null },
    companyRole: { type: String, enum: [...Object.values(COMPANY_ROLES), null], default: null },

    // ── Invitation tracking ────────────────────────────────────────────────
    invitedBy:         { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    invitationToken:   { type: String, select: false },
    invitationExpires: { type: Date,   select: false },
    invitationAccepted:{ type: Boolean, default: false },

    addresses: [addressSchema],
    isActive:  { type: Boolean, default: true },

    // Refresh tokens
    refreshTokens: [
      {
        token:     { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        userAgent: { type: String },
        ip:        { type: String },
      },
    ],

    // Password reset
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },

    country: { type: String, default: "EG" },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Mongoose 7+: async pre-save hooks do NOT receive next()
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.invitationToken;
  delete obj.invitationExpires;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
