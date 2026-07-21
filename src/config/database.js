const mongoose = require("mongoose");
const logger = require("../utils/logger");

console.log("BOOT: attempting MongoDB connection...");
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    console.log("BOOT: MongoDB connected successfully");
    

    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err}`);
      console.error("BOOT: MongoDB connection FAILED:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Attempting reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected.");
    });
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
