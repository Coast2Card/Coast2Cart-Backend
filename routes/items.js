const express = require("express");
const router = express.Router();

const {
  createItem,
  getAllItems,
  getItemsBySeller,
  getItemById,
  updateItem,
  deleteItem,
  sellItem,
  getSoldItemsBySeller,
  getSoldItemsByBuyer,
} = require("../controllers/itemController");

const {
  validateItemCreation,
  validateItemUpdate,
  validateSellItem,
} = require("../middleware/validation");

const { authenticateToken } = require("../middleware/auth");
const { uploadSingle } = require("../middleware/upload");

// Public routes (no authentication required)

// GET /api/items - Get all active items with optional filtering
router.get("/", getAllItems);

// GET /api/items/:itemId - Get single item by ID
router.get("/:itemId", getItemById);

// GET /api/items/seller/:sellerId - Get items by seller (public view)
router.get("/seller/:sellerId", getItemsBySeller);

// Protected routes (authentication required)

// POST /api/items - Create new item (sellers only)
router.post(
  "/",
  authenticateToken,
  uploadSingle,
  validateItemCreation,
  createItem
);

// PUT /api/items/:itemId - Update item (owner only)
router.put(
  "/:itemId",
  authenticateToken,
  uploadSingle,
  validateItemUpdate,
  updateItem
);

// DELETE /api/items/:itemId - Delete item (owner only)
router.delete("/:itemId", authenticateToken, deleteItem);

// POST /api/items/:itemId/sell - Sell an item (owner only)
router.post("/:itemId/sell", authenticateToken, validateSellItem, sellItem);

// GET /api/items/sold/seller/:sellerId - Get sold items by seller
router.get("/sold/seller/:sellerId", getSoldItemsBySeller);

// GET /api/items/sold/buyer/:buyerId - Get sold items by buyer
router.get("/sold/buyer/:buyerId", getSoldItemsByBuyer);

module.exports = router;
