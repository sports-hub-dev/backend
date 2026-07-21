const authService = require("../../src/services/authService");
const User        = require("../../src/models/User");

jest.mock("../../src/models/User");
jest.mock("../../src/utils/emailUtils");

describe("authService", () => {
  afterEach(() => jest.clearAllMocks());

  describe("register()", () => {
    it("should throw 409 if email already exists", async () => {
      User.findOne.mockResolvedValue({ email: "test@test.com" });
      await expect(
        authService.register({ firstName:"A", lastName:"B", email:"test@test.com", password:"Pass123!" })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("should create and return a safe user object", async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: "abc123", firstName:"Ahmed", lastName:"Hassan", email:"a@test.com", role:"customer",
        toSafeObject: () => ({ _id:"abc123", email:"a@test.com" }),
      });
      const result = await authService.register({ firstName:"Ahmed", lastName:"Hassan", email:"a@test.com", password:"Pass123!" });
      expect(result).toHaveProperty("email", "a@test.com");
    });
  });

  describe("login()", () => {
    it("should throw 401 if user not found", async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      await expect(authService.login("bad@email.com","pass")).rejects.toMatchObject({ statusCode: 401 });
    });

    it("should throw 401 if password is wrong", async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ comparePassword: jest.fn().mockResolvedValue(false) }) });
      await expect(authService.login("test@test.com","wrongpass")).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
