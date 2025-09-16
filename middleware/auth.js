const jwt = require("jsonwebtoken");
const Account = require("../models/Accounts");
const { UnauthenticatedError } = require("../errors");

/**
 * Middleware to authenticate JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      throw new UnauthenticatedError("Access token required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and attach to request
    const user = await Account.findById(decoded.userId).select(
      "-password -otp"
    );

    if (!user) {
      throw new UnauthenticatedError("User not found");
    }

    if (!user.isVerified) {
      throw new UnauthenticatedError(
        "Account not verified. Please verify your account first."
      );
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new UnauthenticatedError("Invalid token"));
    }
    if (error.name === "TokenExpiredError") {
      return next(new UnauthenticatedError("Token expired"));
    }
    next(error);
  }
};

/**
 * Middleware to check if user has specific role
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthenticatedError("Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new UnauthenticatedError("Insufficient permissions"));
    }

    next();
  };
};

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  generateToken,
};
