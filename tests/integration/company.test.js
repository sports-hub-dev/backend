const request  = require("supertest");
const mongoose = require("mongoose");
const app      = require("../../src/app");
const User     = require("../../src/models/User");
const Company  = require("../../src/models/Company");

const MONGO_TEST_URI = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/sportshub_test";

let adminToken;

beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI);
  await User.deleteMany({});
  await Company.deleteMany({});
  // Create admin
  const reg = await request(app).post("/api/v1/auth/register").send({
    firstName:"Admin", lastName:"User", email:"admin@test.com", password:"Password1",
  });
  await User.findByIdAndUpdate(reg.body.data.user._id, { role:"admin" });
  const login = await request(app).post("/api/v1/auth/login").send({ email:"admin@test.com", password:"Password1" });
  adminToken = login.body.data.accessToken;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe("POST /api/v1/b2b/companies", () => {
  it("should create a company (admin)", async () => {
    const res = await request(app)
      .post("/api/v1/b2b/companies")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name:"Test Corp", email:"corp@test.com", phone:"+201001234567" });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.company).toHaveProperty("name","Test Corp");
    expect(res.body.data.company.status).toBe("pending");
  });

  it("should return 401 without token", async () => {
    const res = await request(app).post("/api/v1/b2b/companies").send({ name:"Test", email:"t@test.com" });
    expect(res.statusCode).toBe(401);
  });

  it("should return 400 for missing required fields", async () => {
    const res = await request(app)
      .post("/api/v1/b2b/companies")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name:"No Email Co" });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/v1/b2b/companies/:id/approve", () => {
  it("should approve a company", async () => {
    const create = await request(app)
      .post("/api/v1/b2b/companies")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name:"Approvable Corp", email:"approvable@test.com" });
    const companyId = create.body.data.company._id;
    const res = await request(app)
      .patch(`/api/v1/b2b/companies/${companyId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.company.status).toBe("active");
  });
});
