const express = require("express");
const router = express.Router();
const { body, param, query } = require("express-validator");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncErrorHandler");
const {
  createOrGetChatRoom,
  getUserChatRooms,
  getChatMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
  getChatRoomDetails,
  markItemAsSold,
  updateRequestedQuantity,
} = require("../controllers/chatController");

// Authentication middleware will be applied to individual routes

// Validation middleware
const validateCreateChatRoom = [
  body("participantId")
    .notEmpty()
    .withMessage("Participant ID is required")
    .isMongoId()
    .withMessage("Invalid participant ID"),
  body("itemId").optional().isMongoId().withMessage("Invalid item ID"),
  body("quantity")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Quantity must be a positive number"),
];

const validateSendMessage = [
  body("chatRoomId")
    .notEmpty()
    .withMessage("Chat room ID is required")
    .isMongoId()
    .withMessage("Invalid chat room ID"),
  body("messageType")
    .isIn(["text", "product", "image", "file"])
    .withMessage("Invalid message type"),
  body("content").isObject().withMessage("Content must be an object"),
  body("content.text")
    .if(body("messageType").equals("text"))
    .notEmpty()
    .withMessage("Text content is required for text messages"),
  body("content.product")
    .if(body("messageType").equals("product"))
    .isObject()
    .withMessage("Product content is required for product messages"),
];

const validateChatRoomId = [
  param("chatRoomId").isMongoId().withMessage("Invalid chat room ID"),
];

const validateMessageId = [
  param("messageId").isMongoId().withMessage("Invalid message ID"),
];

const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

const validateUpdateQuantity = [
  body("quantity")
    .isFloat({ min: 0.01 })
    .withMessage("Quantity must be a positive number"),
];

// Routes

/**
 * @route   POST /api/chat/rooms
 * @desc    Create or get existing chat room between two users
 * @access  Private
 */
router.post(
  "/rooms",
  authenticateToken,
  ...validateCreateChatRoom,
  asyncHandler(createOrGetChatRoom)
);

/**
 * @route   GET /api/chat/rooms
 * @desc    Get user's chat rooms
 * @access  Private
 */
router.get("/rooms", authenticateToken, asyncHandler(getUserChatRooms));

/**
 * @route   GET /api/chat/rooms/:chatRoomId
 * @desc    Get chat room details
 * @access  Private
 */
router.get(
  "/rooms/:chatRoomId",
  authenticateToken,
  ...validateChatRoomId,
  asyncHandler(getChatRoomDetails)
);

/**
 * @route   GET /api/chat/rooms/:chatRoomId/messages
 * @desc    Get messages for a chat room with pagination
 * @access  Private
 */
router.get(
  "/rooms/:chatRoomId/messages",
  authenticateToken,
  ...validateChatRoomId,
  ...validatePagination,
  asyncHandler(getChatMessages)
);

/**
 * @route   POST /api/chat/messages
 * @desc    Send a message (REST endpoint - use Socket.io for real-time)
 * @access  Private
 */
router.post(
  "/messages",
  authenticateToken,
  ...validateSendMessage,
  asyncHandler(sendMessage)
);

/**
 * @route   PUT /api/chat/rooms/:chatRoomId/read
 * @desc    Mark all messages in chat room as read
 * @access  Private
 */
router.put(
  "/rooms/:chatRoomId/read",
  authenticateToken,
  ...validateChatRoomId,
  asyncHandler(markMessagesAsRead)
);

/**
 * @route   PUT /api/chat/rooms/:chatRoomId/messages/read
 * @desc    Mark all messages in chat room as read (alternative endpoint)
 * @access  Private
 */
router.put(
  "/rooms/:chatRoomId/messages/read",
  authenticateToken,
  ...validateChatRoomId,
  asyncHandler(markMessagesAsRead)
);

/**
 * @route   DELETE /api/chat/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete(
  "/messages/:messageId",
  authenticateToken,
  ...validateMessageId,
  asyncHandler(deleteMessage)
);

/**
 * @route   POST /api/chat/rooms/:chatRoomId/mark-sold
 * @desc    Mark item as sold in chat room (uses stored requested quantity)
 * @access  Private (Seller only)
 */
router.post(
  "/rooms/:chatRoomId/mark-sold",
  authenticateToken,
  authorizeRoles("seller"),
  ...validateChatRoomId,
  asyncHandler(markItemAsSold)
);

/**
 * @route   PUT /api/chat/rooms/:chatRoomId/quantity
 * @desc    Update requested quantity in chat room
 * @access  Private (Buyer only)
 */
router.put(
  "/rooms/:chatRoomId/quantity",
  authenticateToken,
  ...validateChatRoomId,
  ...validateUpdateQuantity,
  asyncHandler(updateRequestedQuantity)
);

module.exports = router;
