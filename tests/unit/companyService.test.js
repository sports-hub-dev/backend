const companyService = require("../../src/services/b2b/companyService");
const Company        = require("../../src/models/Company");
const User           = require("../../src/models/User");
const AuditLog       = require("../../src/models/AuditLog");

jest.mock("../../src/models/Company");
jest.mock("../../src/models/User");
jest.mock("../../src/models/AuditLog");
jest.mock("../../src/utils/emailUtils");

describe("companyService", () => {
  afterEach(() => jest.clearAllMocks());

  describe("createCompany()", () => {
    it("should throw 409 if email already exists", async () => {
      Company.findOne.mockResolvedValue({ email: "existing@co.com" });
      await expect(
        companyService.createCompany({ email: "existing@co.com", name: "Test Co" }, "adminId")
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("should create and return a company", async () => {
      Company.findOne.mockResolvedValue(null);
      Company.create.mockResolvedValue({ _id: "co1", name: "New Co", email: "new@co.com" });
      AuditLog.create.mockResolvedValue({});
      const result = await companyService.createCompany({ name: "New Co", email: "new@co.com" }, "adminId");
      expect(result).toHaveProperty("name", "New Co");
    });
  });

  describe("approveCompany()", () => {
    it("should throw 404 if company not found", async () => {
      Company.findById.mockResolvedValue(null);
      await expect(companyService.approveCompany("bad-id", "admin")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should throw 400 if already active", async () => {
      Company.findById.mockResolvedValue({ status: "active", save: jest.fn() });
      await expect(companyService.approveCompany("id", "admin")).rejects.toMatchObject({ statusCode: 400 });
    });

    it("should approve a pending company", async () => {
      const mockCompany = { status: "pending", isActive: false, save: jest.fn().mockResolvedValue(true) };
      Company.findById.mockResolvedValue(mockCompany);
      AuditLog.create.mockResolvedValue({});
      const result = await companyService.approveCompany("id", "admin");
      expect(result.status).toBe("active");
      expect(result.isActive).toBe(true);
    });
  });
});
