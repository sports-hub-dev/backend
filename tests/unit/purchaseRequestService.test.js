const prService = require("../../src/services/b2b/purchaseRequestService");
const PurchaseRequest = require("../../src/models/PurchaseRequest");
const Company = require("../../src/models/Company");

jest.mock("../../src/models/PurchaseRequest");
jest.mock("../../src/models/Company");
jest.mock("../../src/models/AuditLog");
jest.mock("../../src/utils/emailUtils");
jest.mock("../../src/services/b2b/companyService", () => ({
  resolvePrice: jest.fn().mockResolvedValue({ price: 350, source: "rrp" }),
}));
jest.mock("../../src/utils/logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));

describe("purchaseRequestService", () => {
  afterEach(() => jest.clearAllMocks());

  describe("submitRequest()", () => {
    it("should throw 404 if request not found", async () => {
      PurchaseRequest.findById.mockResolvedValue(null);
      await expect(prService.submitRequest("bad-id", "userId")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should throw 403 if not the requestor", async () => {
      PurchaseRequest.findById.mockResolvedValue({ requestedBy: { toString: () => "other" }, status: "draft" });
      await expect(prService.submitRequest("id", "userId")).rejects.toMatchObject({ statusCode: 403 });
    });

    it("should throw 400 if not in draft status", async () => {
      PurchaseRequest.findById.mockResolvedValue({
        requestedBy: { toString: () => "userId" },
        status: "pending_approval",
      });
      await expect(prService.submitRequest("id", "userId")).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("rejectRequest()", () => {
    it("should throw 400 if not pending approval", async () => {
      PurchaseRequest.findById.mockResolvedValue({ status: "draft" });
      await expect(prService.rejectRequest("id", "uid", "Admin", "reason")).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
