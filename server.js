require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectDB, closeConnection } = require("./db/connect");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://your-frontend-domain.com"]
        : ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  const mongoose = require("mongoose");

  // Get database connection status
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  // Try to establish connection if not connected
  if (dbStatus === 0 && process.env.MONGODB_URI) {
    console.log("Attempting to connect to MongoDB...");
    mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      })
      .catch((err) => {
        console.error("MongoDB connection attempt failed:", err.message);
      });
  }

  res.json({
    message: "Coast2Cart Backend Server",
    status: "running",
    database: {
      status: dbStatusText[dbStatus] || "unknown",
      connected: dbStatus === 1,
      readyState: dbStatus,
      hasUri: !!process.env.MONGODB_URI,
    },
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const mongoose = require("mongoose");

  const dbStatus = mongoose.connection.readyState;
  const isHealthy = dbStatus === 1; // 1 = connected

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus === 1,
      status: dbStatus === 1 ? "connected" : "disconnected",
    },
    uptime: process.uptime(),
  });
});

// ^ ROUTES
app.use("/api/auth", require("./routes/auth"));
app.use("/api/items", require("./routes/items"));
app.use("/api/cart", require("./routes/cart"));

app.use(errorHandler);

const start = async () => {
  try {
    await connectDB(process.env.MONGODB_URI);
    const server = app.listen(process.env.PORT, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.log(
          `Port ${process.env.PORT} is busy, trying ${process.env.PORT + 1}`
        );
        server.close();
        app.listen(process.env.PORT + 1, () => {
          console.log(`Server is running on port ${process.env.PORT + 1}`);
        });
      } else {
        console.error("Server error:", error);
      }
    });

    process.on("SIGTERM", async () => {
      console.log("SIGTERM received, closing server gracefully...");
      server.close(async () => {
        await closeConnection();
        process.exit(0);
      });
    });

    process.on("SIGINT", async () => {
      console.log("SIGINT received, closing server gracefully...");
      server.close(async () => {
        await closeConnection();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("Server failed to start:", error);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = app;
