require("dotenv").config();

const express = require("express");

const { connectDB, closeConnection } = require("./db/connect");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Coast2Cart backend server." });
});

// ^ ROUTES
app.use("/api/v1/auth", require("./routes/auth"));

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
