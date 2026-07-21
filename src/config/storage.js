module.exports = {
  provider: process.env.STORAGE_PROVIDER || "local",
  baseUrl: process.env.BASE_URL || "http://localhost:5000",
  uploadDir: "src/uploads/products",
};
