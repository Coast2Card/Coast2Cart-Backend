const express = require("express");
const router = express.Router();

const {
  buyerSignup,
  verifyOTP,
  buyerLogin,
  getBuyerProfile,
  resendOTP,
} = require("../controllers/authController");

const {
  validateBuyerSignup,
  checkUsernameUnique,
  checkEmailUnique,
  checkContactUnique,
  validateOTP,
  validateLogin,
} = require("../middleware/validation");

const { authenticateToken } = require("../middleware/auth");

// Buyer Authentication Routes

// POST /api/auth/buyer/signup
router.post(
  "/buyer/signup",
  validateBuyerSignup,
  checkUsernameUnique,
  checkEmailUnique,
  checkContactUnique,
  buyerSignup
);

// POST /api/auth/buyer/verify-otp
router.post("/buyer/verify-otp", validateOTP, verifyOTP);

// POST /api/auth/buyer/login
router.post("/buyer/login", validateLogin, buyerLogin);

// GET /api/auth/buyer/profile (Protected)
router.get("/buyer/profile", authenticateToken, getBuyerProfile);

// POST /api/auth/buyer/resend-otp
router.post("/buyer/resend-otp", resendOTP);

module.exports = router;
