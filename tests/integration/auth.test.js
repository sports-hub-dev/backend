const request  = require("supertest");
const mongoose = require("mongoose");
const app      = require("../../src/app");
const User     = require("../../src/models/User");

const MONGO_TEST_URI = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/sportshub_test";

beforeAll(async () => { await mongoose.connect(MONGO_TEST_URI); });
afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.connection.close(); });
beforeEach(async () => { await User.deleteMany({}); });

describe("POST /api/v1/auth/register", () => {
  it("should register and return 201", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      firstName:"Ahmed", lastName:"Hassan", email:"ahmed@test.com", password:"Password1",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toHaveProperty("email","ahmed@test.com");
  });

  it("should return 400 for weak password", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      firstName:"A", lastName:"B", email:"a@test.com", password:"weak",
    });
    expect(res.statusCode).toBe(400);
  });

  it("should return 409 for duplicate email", async () => {
    await User.create({ firstName:"A", lastName:"B", email:"dup@test.com", password:"Password1" });
    const res = await request(app).post("/api/v1/auth/register").send({
      firstName:"A", lastName:"B", email:"dup@test.com", password:"Password1",
    });
    expect(res.statusCode).toBe(409);
  });
});

describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/v1/auth/register").send({
      firstName:"Ahmed", lastName:"Hassan", email:"ahmed@test.com", password:"Password1",
    });
  });

  it("should login and return tokens", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email:"ahmed@test.com", password:"Password1" });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
  });

  it("should return 401 for wrong password", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email:"ahmed@test.com", password:"WrongPass1" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /health", () => {
  it("should return healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("healthy");
  });
});
