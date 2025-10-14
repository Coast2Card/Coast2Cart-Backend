const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");
const Accounts = require("../models/Accounts");
const Item = require("../models/Item");
const { StatusCodes } = require("http-status-codes");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");

// Create or get chat room between two users
const createOrGetChatRoom = async (req, res) => {
  const { participantId, itemId } = req.body;
  const userId = req.user.userId;

  // Validate inputs
  if (!participantId) {
    throw new BadRequestError("Participant ID is required");
  }

  if (participantId.toString() === userId.toString()) {
    throw new BadRequestError("Cannot create chat room with yourself");
  }

  // Verify participant exists
  const participant = await Accounts.findById(participantId);
  if (!participant) {
    throw new NotFoundError("Participant not found");
  }

  // Check if item exists (if provided)
  if (itemId) {
    const item = await Item.findById(itemId);
    if (!item) {
      throw new NotFoundError("Item not found");
    }
  }

  // Check if chat room already exists
  let chatRoom = await ChatRoom.findOne({
    participants: { $all: [userId, participantId] },
  }).populate("participants", "username profilePicture");

  if (!chatRoom) {
    // Create new chat room
    chatRoom = new ChatRoom({
      participants: [userId, participantId],
      itemId: itemId || null,
      unreadCount: new Map([
        [userId, 0],
        [participantId, 0],
      ]),
    });

    await chatRoom.save();
    await chatRoom.populate("participants", "username profilePicture");
  }

  // If itemId was provided and chat room doesn't have it, update it
  if (itemId && !chatRoom.itemId) {
    chatRoom.itemId = itemId;
    await chatRoom.save();
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: chatRoom,
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
  if (!chatRoom || !chatRoom.participants.includes(userId)) {
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
  if (!chatRoom || !chatRoom.participants.includes(userId)) {
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
  if (!chatRoom || !chatRoom.participants.includes(userId)) {
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

  if (!chatRoom || !chatRoom.participants.includes(userId)) {
    throw new UnauthorizedError("Not authorized to view this chat room");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: chatRoom,
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
};
