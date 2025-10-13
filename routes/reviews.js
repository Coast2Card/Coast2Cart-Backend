const express = require("express");
const router = express.Router();

const { createSellerReview, listSellerReviews, listBuyerReviews } = require("../controllers/reviewController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// Public: list reviews for a seller
// GET /api/reviews/seller/:sellerId
router.get("/seller/:sellerId", listSellerReviews);

// Public: list reviews by a buyer (newest first)
// GET /api/reviews/buyer/:buyerId
router.get("/buyer/:buyerId", listBuyerReviews);

// Protected: create a review for a seller
// POST /api/reviews/seller/:sellerId
router.post(
  "/seller/:sellerId",
  authenticateToken,
  authorizeRoles("buyer"),
  createSellerReview
);

module.exports = router;


