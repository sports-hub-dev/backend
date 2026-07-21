const crypto = require("crypto");
const Company = require("../../models/Company");
const User = require("../../models/User");
const PricingTier = require("../../models/PricingTier");
const AuditLog = require("../../models/AuditLog");
const AppError = require("../../utils/AppError");
const { sendEmail } = require("../../utils/emailUtils");
const { COMPANY_STATUS, COMPANY_ROLES, ROLES } = require("../../utils/constants");

const companyService = {

  async createCompany(data, adminId) {
    const existing = await Company.findOne({ $or: [{ email: data.email }, ...(data.taxId ? [{ taxId: data.taxId }] : [])] });
    if (existing) throw new AppError("A company with this email or tax ID already exists", 409);

    const company = await Company.create({ ...data, status: COMPANY_STATUS.PENDING, isActive: false });

    await AuditLog.create({
      userId: adminId, action: "company.created",
      resourceType: "Company", resourceId: company._id,
      newValue: { name: company.name, email: company.email },
    });

    return company;
  },

  async approveCompany(companyId, adminId) {
    const company = await Company.findById(companyId);
    if (!company) throw new AppError("Company not found", 404);
    if (company.status === COMPANY_STATUS.ACTIVE) throw new AppError("Company is already active", 400);

    company.status   = COMPANY_STATUS.ACTIVE;
    company.isActive = true;
    company.approvedBy = adminId;
    company.approvedAt = new Date();
    await company.save();

    await AuditLog.create({ userId: adminId, action: "company.approved", resourceType: "Company", resourceId: company._id });
    return company;
  },

  async inviteEmployee(companyId, inviterId, { email, firstName, lastName, companyRole }) {
    const company = await Company.findById(companyId);
    if (!company || !company.isActive) throw new AppError("Company not found or inactive", 404);

    const existing = await User.findOne({ email });
    if (existing) throw new AppError("A user with this email already exists", 409);

    // Raw token for email, hashed for storage
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    const invitedUser = await User.create({
      firstName, lastName, email,
      password: crypto.randomBytes(16).toString("hex"), // placeholder — reset on acceptance
      role: ROLES.CUSTOMER,
      companyId, companyRole,
      invitedBy: inviterId,
      invitationToken: hashedToken,
      invitationExpires: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 h
      invitationAccepted: false,
      isActive: false,
    });

    const acceptUrl = `${process.env.CLIENT_URL}/accept-invitation/${rawToken}`;
    await sendEmail({
      to: email,
      subject: `You've been invited to join ${company.name} on Sports Hub`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#1B2A4A;">You're invited!</h2>
          <p><strong>${company.name}</strong> has invited you to join Sports Hub as a <strong>${companyRole}</strong>.</p>
          <p>Click the button below to set your password and activate your account:</p>
          <a href="${acceptUrl}"
             style="display:inline-block;padding:12px 28px;background:#2563EB;color:#fff;text-decoration:none;border-radius:4px;margin:20px 0;">
            Accept Invitation
          </a>
          <p>This link expires in <strong>48 hours</strong>.</p>
          <p style="color:#94A3B8;font-size:13px;">Sports Hub B2B Portal</p>
        </div>`,
    });

    await AuditLog.create({
      userId: inviterId, companyId, action: "user.invited",
      resourceType: "User", resourceId: invitedUser._id,
      newValue: { email, companyRole },
    });

    return { message: "Invitation sent", userId: invitedUser._id };
  },

  async acceptInvitation(rawToken, password) {
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const user = await User.findOne({
      invitationToken: hashedToken,
      invitationExpires: { $gt: Date.now() },
      invitationAccepted: false,
    }).select("+invitationToken +invitationExpires");

    if (!user) throw new AppError("Invitation token is invalid or has expired", 400);

    user.password = password;
    user.invitationToken    = undefined;
    user.invitationExpires  = undefined;
    user.invitationAccepted = true;
    user.isActive = true;
    await user.save();

    return user.toSafeObject();
  },

  async resolvePrice(productId, companyId, quantity = 1) {
    const CompanyPrice = require("../../models/CompanyPrice");
    const Product      = require("../../models/Product");

    const product = await Product.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    const basePrice = product.price;

    // 1. Company-specific override
    const now = new Date();
    const override = await CompanyPrice.findOne({
      companyId, productId,
      validFrom: { $lte: now },
      $or: [{ validTo: null }, { validTo: { $gte: now } }],
    });
    if (override) return { price: override.customPrice, source: "company_override" };

    // 2. Pricing tier discount
    const company = await Company.findById(companyId);
    if (company?.pricingTier) {
      const tier = await PricingTier.findOne({ name: company.pricingTier, isActive: true });
      if (tier && tier.discountPercentage > 0) {
        const discounted = parseFloat((basePrice * (1 - tier.discountPercentage / 100)).toFixed(2));
        return { price: discounted, source: `tier_${tier.name}`, discount: tier.discountPercentage };
      }
    }

    // 3. Fallback to RRP
    return { price: basePrice, source: "rrp" };
  },
};

module.exports = companyService;
