const mongoose = require("mongoose");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async (url) => {
  try {
    console.log("Checking MongoDB connection...");

    if (cached.conn) {
      if (mongoose.connection.readyState === 1) {
        console.log("Using existing MongoDB connection.");
        return cached.conn;
      } else {
        console.log("Cached connection is no longer valid.");
        cached.conn = null;
        cached.promise = null;
      }
    }

    if (!cached.promise) {
      const opts = {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        maxPoolSize: 5,
        minPoolSize: 1,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        retryReads: true,
        heartbeatFrequencyMS: 10000,
      };

      console.log("Creating a new MongoDB connection...");
      cached.promise = mongoose.connect(url, opts).then((mongoose) => {
        console.log("Successfully connected to MongoDB!");

        mongoose.connection.on("error", (err) => {
          console.error("MongoDB connection error:", err);
          cached.conn = null;
          cached.promise = null;
        });

        mongoose.connection.on("disconnected", (err) => {
          console.log("MongoDB disconnected");
          cached.conn = null;
          cached.promise = null;
        });

        return mongoose;
      });
    }

    cached.conn = await cached.promise;

    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB connection not ready after connection attempt.");
    }

    return cached.conn;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    cached.promise = null;
    throw error;
  }
};

const closeConnection = async () => {
  if (cached.conn) {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed gracefully.");
      cached.conn = null;
      cached.promise = null;
    } catch (error) {
      console.error("Error closing MongoDB connection:", error);
    }
  }
};

module.exports = { connectDB, closeConnection };
