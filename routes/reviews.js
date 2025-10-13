const express = require("express");
const router = express.Router();

const { createSellerReview, listSellerReviews } = require("../controllers/reviewController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// Public: list reviews for a seller
// GET /api/reviews/seller/:sellerId
router.get("/seller/:sellerId", listSellerReviews);

// Protected: create a review for a seller
// POST /api/reviews/seller/:sellerId
router.post(
  "/seller/:sellerId",
  authenticateToken,
  authorizeRoles("buyer"),
  createSellerReview
);

module.exports = router;


