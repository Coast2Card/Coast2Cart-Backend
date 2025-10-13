const express = require("express");
const router = express.Router();

const {
  signup,
  verifyOTP,
  login,
  resendOTP,
} = require("../controllers/authController");

const {
  validateSignup,
  checkUsernameUnique,
  checkEmailUnique,
  checkContactUnique,
  validateOTP,
  validateLogin,
} = require("../middleware/validation");

const { authenticateToken } = require("../middleware/auth");

// Authentication Routes

// POST /api/auth/signup (Unified signup for buyers and sellers)
router.post(
  "/signup",
  validateSignup,
  checkUsernameUnique,
  checkEmailUnique,
  checkContactUnique,
  signup
);

// POST /api/auth/verify-otp (Unified OTP verification for buyers and sellers)
router.post("/verify-otp", validateOTP, verifyOTP);

// POST /api/auth/login (General login for all account types)
router.post("/login", validateLogin, login);

// POST /api/auth/resend-otp (Unified OTP resend for buyers and sellers)
router.post("/resend-otp", resendOTP);

module.exports = router;
