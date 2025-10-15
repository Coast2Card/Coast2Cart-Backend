const mongoose = require("mongoose");
const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");
const Accounts = require("../models/Accounts");
const Item = require("../models/Item");
const Transaction = require("../models/Transaction");
const { StatusCodes } = require("http-status-codes");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");
const {
  removeItemFromUserCart,
  updateCartQuantitiesForReducedStock,
  cleanupCartsForInactiveItem,
} = require("../services/cartCleanupService");

// Create or get chat room between two users
const createOrGetChatRoom = async (req, res) => {
  const { participantId, itemId, quantity } = req.body;
  const userId = req.user?.userId || req.user?._id;

  // Validate inputs
  if (!participantId) {
    throw new BadRequestError("Participant ID is required");
  }

  if (!userId) {
    throw new UnauthorizedError("User authentication failed");
  }

  if (participantId.toString() === userId.toString()) {
    throw new BadRequestError("Cannot create chat room with yourself");
  }

  // Verify participant exists
  const participant = await Accounts.findById(participantId);
  if (!participant) {
    throw new NotFoundError("Participant not found");
  }

  // Fetch item if provided
  let item = null;
  if (itemId) {
    item = await Item.findById(itemId);
    if (!item) {
      throw new NotFoundError("Item not found");
    }
  }

  // Validate quantity if provided
  if (quantity !== undefined && (quantity <= 0 || !Number.isFinite(quantity))) {
    throw new BadRequestError("Quantity must be a positive number");
  }

  // Set default quantity to 1 if not provided
  const requestedQuantity = quantity || 1;

  // Check if chat room already exists
  let chatRoom = await ChatRoom.findOne({
    participants: { $all: [userId, participantId] },
  }).populate("participants", "username profilePicture");

  let isNewChatRoom = false;
  if (!chatRoom) {
    // Create new chat room
    chatRoom = new ChatRoom({
      participants: [userId, participantId],
      itemId: itemId || null,
      requestedQuantity: requestedQuantity,
      requestedUnit: item ? item.unit : null,
      unreadCount: new Map([
        [userId, 0],
        [participantId, 0],
      ]),
    });

    await chatRoom.save();
    await chatRoom.populate("participants", "username profilePicture");
    isNewChatRoom = true;
  }

  // Create transaction if item and quantity are provided
  let transaction = null;
  if (itemId && quantity && item) {
    // Validate quantity
    if (quantity <= 0) {
      throw new BadRequestError("Quantity must be greater than 0");
    }

    if (quantity > item.quantity) {
      throw new BadRequestError(
        `Not enough stock available. Only ${item.quantity} ${item.unit} available.`
      );
    }

    // Create transaction
    transaction = new Transaction({
      chatRoomId: chatRoom._id,
      itemId: item._id,
      buyerId: userId,
      sellerId: item.seller,
      quantity: quantity,
      unit: item.unit,
      priceAtTransaction: item.itemPrice,
      totalPrice: item.itemPrice * quantity,
      status: "pending",
    });

    await transaction.save();
    await transaction.populate("itemId", "itemName itemPrice image unit");

    // Send automatic product message in chat
    const productMessage = new Message({
      chatRoomId: chatRoom._id,
      senderId: userId,
      messageType: "product",
      content: {
        product: {
          productId: item._id,
          name: item.itemName,
          description: item.description,
          price: `₱${item.itemPrice}/${item.unit}`,
          image: item.image,
        },
        transactionId: transaction._id,
        quantity: quantity,
        totalPrice: transaction.totalPrice,
      },
    });

    await productMessage.save();

    // Update chat room last message
    await ChatRoom.findByIdAndUpdate(chatRoom._id, {
      lastMessage: `New order: ${quantity} ${item.unit} of ${item.itemName}`,
      lastMessageAt: new Date(),
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      chatRoom,
      transaction,
      isNewChatRoom,
    },
  });
};

// Get user's chat rooms
const getUserChatRooms = async (req, res) => {
  const userId = req.user.userId;

  const chatRooms = await ChatRoom.find({
    participants: userId,
  })
    .populate("participants", "username profilePicture")
    .populate("itemId", "itemName itemPrice image")
    .sort({ lastMessageAt: -1 });

  // Get unread counts for each chat room
  const chatRoomsWithUnread = chatRooms.map((chatRoom) => {
    const unreadCount = chatRoom.unreadCount.get(userId) || 0;
    return {
      ...chatRoom.toObject(),
      unreadCount,
    };
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: chatRoomsWithUnread,
  });
};

// Get messages for a specific chat room
const getChatMessages = async (req, res) => {
  const { chatRoomId } = req.params;
  const userId = req.user.userId;
  const { page = 1, limit = 50 } = req.query;

  // Verify user is participant in this chat
  const chatRoom = await ChatRoom.findById(chatRoomId);
  if (!chatRoom) {
    throw new NotFoundError("Chat room not found");
  }

  // Check if user is participant (convert ObjectIds to strings for comparison)
  const participantIds = chatRoom.participants.map((id) => id.toString());
  if (!participantIds.includes(userId.toString())) {
    throw new UnauthorizedError("Not authorized to view this chat");
  }

  // Get messages with pagination
  const skip = (page - 1) * limit;
  const messages = await Message.find({ chatRoomId })
    .populate("senderId", "username profilePicture")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Mark messages as read for this user
  await Message.updateMany(
    {
      chatRoomId,
      senderId: { $ne: userId },
      "readBy.userId": { $ne: userId },
    },
    { $push: { readBy: { userId, readAt: new Date() } } }
  );

  // Reset unread count for this user
  await ChatRoom.findByIdAndUpdate(chatRoomId, {
    $set: { [`unreadCount.${userId}`]: 0 },
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: messages.reverse(), // Return in chronological order
  });
};

// Send a message (for REST API - Socket.io is preferred for real-time)
const sendMessage = async (req, res) => {
  const { chatRoomId, messageType, content } = req.body;
  const userId = req.user.userId;

  // Validate inputs
  if (!chatRoomId || !messageType || !content) {
    throw new BadRequestError(
      "Chat room ID, message type, and content are required"
    );
  }

  // Verify user is participant
  const chatRoom = await ChatRoom.findById(chatRoomId);
  if (!chatRoom) {
    throw new NotFoundError("Chat room not found");
  }

  // Check if user is participant (convert ObjectIds to strings for comparison)
  const participantIds = chatRoom.participants.map((id) => id.toString());
  if (!participantIds.includes(userId.toString())) {
    throw new UnauthorizedError("Not authorized to send message to this chat");
  }

  // Handle product message - fetch product details if only productId is provided
  let messageContent = content;
  if (
    messageType === "product" &&
    content.productId &&
    !content.product?.name
  ) {
    const product = await Item.findById(content.productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    messageContent = {
      product: {
        productId: product._id,
        name: product.itemName,
        description: product.description,
        price: `₱${product.itemPrice}/${product.unit}`,
        image: product.image,
      },
    };
  }

  // Create new message
  const newMessage = new Message({
    chatRoomId,
    senderId: userId,
    messageType,
    content: messageContent,
  });

  await newMessage.save();
  await newMessage.populate("senderId", "username profilePicture");

  // Update chat room last message
  const lastMessageText =
    messageType === "text"
      ? messageContent.text
      : messageType === "product"
      ? `Shared: ${messageContent.product.name}`
      : `Sent a ${messageType}`;

  await ChatRoom.findByIdAndUpdate(chatRoomId, {
    lastMessage: lastMessageText,
    lastMessageAt: new Date(),
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    data: newMessage,
  });
};

// Mark messages as read
const markMessagesAsRead = async (req, res) => {
  const { chatRoomId } = req.params;
  const userId = req.user.userId;

  // Verify user is participant
  const chatRoom = await ChatRoom.findById(chatRoomId);
  if (!chatRoom) {
    throw new NotFoundError("Chat room not found");
  }

  // Check if user is participant (convert ObjectIds to strings for comparison)
  const participantIds = chatRoom.participants.map((id) => id.toString());
  if (!participantIds.includes(userId.toString())) {
    throw new UnauthorizedError("Not authorized to access this chat");
  }

  // Mark all messages as read for this user
  await Message.updateMany(
    {
      chatRoomId,
      senderId: { $ne: userId },
      "readBy.userId": { $ne: userId },
    },
    { $push: { readBy: { userId, readAt: new Date() } } }
  );

  // Reset unread count
  await ChatRoom.findByIdAndUpdate(chatRoomId, {
    $set: { [`unreadCount.${userId}`]: 0 },
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Messages marked as read",
  });
};

// Delete a message
const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  const message = await Message.findById(messageId);
  if (!message) {
    throw new NotFoundError("Message not found");
  }

  // Only sender can delete their own messages
  if (message.senderId.toString() !== userId.toString()) {
    throw new UnauthorizedError("Not authorized to delete this message");
  }

  await Message.findByIdAndDelete(messageId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Message deleted successfully",
  });
};

// Get chat room details
const getChatRoomDetails = async (req, res) => {
  const { chatRoomId } = req.params;
  const userId = req.user.userId;

  const chatRoom = await ChatRoom.findById(chatRoomId)
    .populate("participants", "username profilePicture")
    .populate("itemId", "itemName itemPrice image");

  if (!chatRoom) {
    throw new NotFoundError("Chat room not found");
  }

  // Check if user is participant (convert ObjectIds to strings for comparison)
  const participantIds = chatRoom.participants.map((id) => id.toString());
  if (!participantIds.includes(userId.toString())) {
    throw new UnauthorizedError("Not authorized to view this chat room");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: chatRoom,
  });
};

// Get transactions for a chat room
const getChatTransactions = async (req, res) => {
  const { chatRoomId } = req.params;
  const userId = req.user?.userId || req.user?._id;

  // Verify user is participant in this chat
  const chatRoom = await ChatRoom.findById(chatRoomId);
  if (!chatRoom) {
    throw new NotFoundError("Chat room not found");
  }

  // Check if user is participant (convert ObjectIds to strings for comparison)
  const participantIds = chatRoom.participants.map((id) => id.toString());
  if (!participantIds.includes(userId.toString())) {
    throw new UnauthorizedError("Not authorized to view this chat");
  }

  const transactions = await Transaction.find({ chatRoomId })
    .populate("itemId", "itemName itemPrice image unit quantity")
    .populate("buyerId", "username profilePicture")
    .populate("sellerId", "username profilePicture")
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    success: true,
    data: transactions,
  });
};

// Add new transaction to existing chat room
const addTransactionToChatRoom = async (req, res) => {
  const { chatRoomId } = req.params;
  const { itemId, quantity } = req.body;
  const userId = req.user?.userId || req.user?._id;

  // Validate inputs
  if (!itemId || !quantity) {
    throw new BadRequestError("Item ID and quantity are required");
  }

  if (!userId) {
    throw new UnauthorizedError("User authentication failed");
  }

  // Verify user is participant in this chat
  const chatRoom = await ChatRoom.findById(chatRoomId);
  if (!chatRoom) {
    throw new NotFoundError("Chat room not found");
  }

  // Check if user is participant (convert ObjectIds to strings for comparison)
  const participantIds = chatRoom.participants.map((id) => id.toString());
  if (!participantIds.includes(userId.toString())) {
    throw new UnauthorizedError(
      "Not authorized to add transaction to this chat"
    );
  }

  // Fetch item
  const item = await Item.findById(itemId);
  if (!item) {
    throw new NotFoundError("Item not found");
  }

  // Validate quantity
  if (quantity <= 0) {
    throw new BadRequestError("Quantity must be greater than 0");
  }

  if (quantity > item.quantity) {
    throw new BadRequestError(
      `Not enough stock available. Only ${item.quantity} ${item.unit} available.`
    );
  }

  // Determine buyer and seller
  const otherParticipant = chatRoom.participants.find(
    (p) => p.toString() !== userId.toString()
  );

  const isBuyer = item.seller.toString() !== userId.toString();
  const buyerId = isBuyer ? userId : otherParticipant;
  const sellerId = isBuyer ? otherParticipant : userId;

  // Create transaction
  const transaction = new Transaction({
    chatRoomId: chatRoom._id,
    itemId: item._id,
    buyerId: buyerId,
    sellerId: sellerId,
    quantity: quantity,
    unit: item.unit,
    priceAtTransaction: item.itemPrice,
    totalPrice: item.itemPrice * quantity,
    status: "pending",
  });

  await transaction.save();
  await transaction.populate("itemId", "itemName itemPrice image unit");

  // Send automatic product message in chat
  const productMessage = new Message({
    chatRoomId: chatRoom._id,
    senderId: userId,
    messageType: "product",
    content: {
      product: {
        productId: item._id,
        name: item.itemName,
        description: item.description,
        price: `₱${item.itemPrice}/${item.unit}`,
        image: item.image,
      },
      transactionId: transaction._id,
      quantity: quantity,
      totalPrice: transaction.totalPrice,
    },
  });

  await productMessage.save();

  // Update chat room last message
  await ChatRoom.findByIdAndUpdate(chatRoom._id, {
    lastMessage: `New order: ${quantity} ${item.unit} of ${item.itemName}`,
    lastMessageAt: new Date(),
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    data: transaction,
  });
};

// Mark transaction as sold
const markTransactionAsSold = async (req, res) => {
  const { chatRoomId, transactionId } = req.params;
  const userId = req.user?.userId || req.user?._id;

  // Debug logging
  console.log("=== DEBUG markTransactionAsSold ===");
  console.log("chatRoomId:", chatRoomId);
  console.log("transactionId:", transactionId);
  console.log("userId:", userId);
  console.log("req.user:", req.user);

  // Validate user
  if (!userId) {
    throw new UnauthorizedError("User authentication failed");
  }

  // Verify user is participant in this chat
  const chatRoom = await ChatRoom.findById(chatRoomId);
  console.log("chatRoom:", chatRoom);
  console.log("chatRoom.participants:", chatRoom?.participants);

  if (!chatRoom) {
    throw new NotFoundError("Chat room not found");
  }

  // Check if user is participant (convert ObjectIds to strings for comparison)
  const participantIds = chatRoom.participants.map((id) => id.toString());
  console.log("participantIds:", participantIds);
  console.log("userId.toString():", userId.toString());
  console.log("includes check:", participantIds.includes(userId.toString()));

  if (!participantIds.includes(userId.toString())) {
    console.log("❌ Authorization failed - user not in participants");
    throw new UnauthorizedError("Not authorized to access this chat");
  }

  console.log("✅ Authorization passed");

  // Fetch transaction
  const transaction = await Transaction.findById(transactionId).populate(
    "itemId"
  );
  console.log("transaction:", transaction);
  console.log("transaction.sellerId:", transaction?.sellerId);
  console.log("transaction.buyerId:", transaction?.buyerId);

  if (!transaction) {
    throw new NotFoundError("Transaction not found");
  }

  // Verify transaction belongs to this chat room
  if (transaction.chatRoomId.toString() !== chatRoomId) {
    throw new UnauthorizedError(
      "Transaction does not belong to this chat room"
    );
  }

  // Only seller can mark as sold
  if (transaction.sellerId.toString() !== userId.toString()) {
    throw new UnauthorizedError("Only seller can mark transaction as sold");
  }

  // Check if already sold
  if (transaction.status === "sold") {
    throw new BadRequestError("Transaction already marked as sold");
  }

  // Deduct stock from item
  const item = await Item.findById(transaction.itemId);
  if (!item) {
    throw new NotFoundError("Item not found");
  }

  if (item.quantity < transaction.quantity) {
    throw new BadRequestError(
      `Insufficient stock. Current stock: ${item.quantity} ${item.unit}`
    );
  }

  // Update item quantity
  item.quantity -= transaction.quantity;
  await item.save();

  // Update transaction status
  transaction.status = "sold";
  transaction.markedSoldAt = new Date();
  transaction.markedSoldBy = userId;
  await transaction.save();

  // Send automatic system message in chat
  const systemMessage = new Message({
    chatRoomId: chatRoom._id,
    senderId: userId,
    messageType: "text",
    content: {
      text: `✅ Marked as sold: ${transaction.quantity} ${
        transaction.unit
      } of ${item.itemName}. Stock updated: ${
        item.quantity + transaction.quantity
      } → ${item.quantity} ${item.unit}`,
    },
  });

  await systemMessage.save();

  // Update chat room last message
  await ChatRoom.findByIdAndUpdate(chatRoom._id, {
    lastMessage: `Transaction completed: ${transaction.quantity} ${transaction.unit} of ${item.itemName}`,
    lastMessageAt: new Date(),
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      transaction,
      updatedStock: item.quantity,
      message: "Transaction marked as sold and stock updated successfully",
    },
  });
};

module.exports = {
  createOrGetChatRoom,
  getUserChatRooms,
  getChatMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
  getChatRoomDetails,
  getChatTransactions,
  addTransactionToChatRoom,
  markTransactionAsSold,
};
