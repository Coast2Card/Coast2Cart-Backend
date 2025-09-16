const express = require("express");
const router = express.Router();

const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary,
} = require("../controllers/cartController");

const { authenticateToken } = require("../middleware/auth");

// All cart routes require authentication
router.use(authenticateToken);

// POST /api/cart/add - Add item to cart
router.post("/add", addToCart);

// GET /api/cart - Get user's cart
router.get("/", getCart);

// PUT /api/cart/update - Update cart item quantity
router.put("/update", updateCartItem);

// DELETE /api/cart/remove/:itemId - Remove item from cart
router.delete("/remove/:itemId", removeFromCart);

// DELETE /api/cart/clear - Clear entire cart
router.delete("/clear", clearCart);

// GET /api/cart/summary - Get cart summary
router.get("/summary", getCartSummary);

module.exports = router;
