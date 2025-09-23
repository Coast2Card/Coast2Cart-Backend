require("dotenv").config();

const cors = require("cors");
const fileUpload = require("express-fileupload");

const { connectDB, closeConnection } = require("./db/connect");
const errorHandler = require("./middleware/errorHandler");

const express = require("express");
const app = express();
const mongoose = require("mongoose");

const dbStatusText = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

const getDbHealth = () => {
  const state = mongoose.connection.readyState;
  return {
    connected: state === 1,
    status: dbStatusText[state] || "unknown",
    readyState: state,
  };
};

// Middleware
// app.use(
//   cors({
//     origin:
//       process.env.NODE_ENV === "production"
//         ? ["https://your-frontend-domain.com"]
//         : ["http://localhost:5173", "http://localhost:3000"],
//     credentials: true,
//   })
// );
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use(
  fileUpload({
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
    abortOnLimit: true,
    useTempFiles: false,
    createParentPath: true,
  })
);

app.get("/", async (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.json({
    message: "Welcome to the Coast2Cart Backend Server",
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
  const details = getDbHealth();
  const isHealthy = details.connected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    database: details,
    uptime: process.uptime(),
  });
});

// ^ ROUTES
app.use("/api/auth", require("./routes/auth"));
app.use("/api/accounts", require("./routes/accounts"));
app.use("/api/items", require("./routes/items"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/test", require("./routes/test"));

app.use(errorHandler);

const start = async () => {
  try {
    console.log("Starting the server...");

    await connectDB(process.env.MONGODB_URI);
    console.log("Database connection established successfully!");

    const basePort = Number(process.env.PORT) || 4000;
    const server = app.listen(basePort, () => {
      console.log(`Server is running on port ${basePort}`);
      console.log("Server startup completed successfully!");
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.log(`Port ${basePort} is busy, trying ${basePort + 1}`);
        server.close();
        app.listen(basePort + 1, () => {
          console.log(`Server is running on port ${basePort + 1}`);
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
