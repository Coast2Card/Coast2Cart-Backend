const mongoose = require("mongoose");
const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");
const Accounts = require("../models/Accounts");
const Item = require("../models/Item");
const SoldItem = require("../models/SoldItem");
const { StatusCodes } = require("http-status-codes");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");

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

  // Check if item exists (if provided) and get item details
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
  } else {
    // Update existing chat room if new data is provided
    let needsUpdate = false;
    
    if (itemId && !chatRoom.itemId) {
      chatRoom.itemId = itemId;
      chatRoom.requestedUnit = item ? item.unit : null;
      needsUpdate = true;
    }
    
    if (quantity !== undefined && chatRoom.requestedQuantity !== requestedQuantity) {
      chatRoom.requestedQuantity = requestedQuantity;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await chatRoom.save();
    }
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

// Mark item as sold
const markItemAsSold = async (req, res) => {
  const { chatRoomId } = req.params;
  const userId = req.user.userId;

  // Verify user is participant in this chat
  const chatRoom = await ChatRoom.findById(chatRoomId).populate("itemId");
  if (!chatRoom || !chatRoom.participants.includes(userId)) {
    throw new UnauthorizedError("Not authorized to access this chat");
  }

  // Check if chat room has an associated item
  if (!chatRoom.itemId) {
    throw new BadRequestError("This chat room is not associated with any item");
  }

  const item = chatRoom.itemId;

  // Verify the user is the seller of the item
  if (item.seller.toString() !== userId.toString()) {
    throw new UnauthorizedError("Only the seller can mark items as sold");
  }

  // Get seller account details to check seller status
  const sellerAccount = await Accounts.findById(userId);
  if (!sellerAccount) {
    throw new NotFoundError("Seller account not found");
  }

  // Verify seller status is validated (both OTP verified and admin approved)
  if (sellerAccount.status !== "validated") {
    throw new UnauthorizedError("Seller account must be fully validated to mark items as sold");
  }

  // Check if item is still active
  if (!item.isActive) {
    throw new BadRequestError("Cannot mark inactive items as sold");
  }

  // Use the requested quantity from the chat room
  const quantitySold = chatRoom.requestedQuantity;

  // Check if there's enough quantity available
  if (item.quantity < quantitySold) {
    throw new BadRequestError(
      `Insufficient quantity. Available: ${item.quantity} ${item.unit}, Requested: ${quantitySold} ${item.unit}`
    );
  }

  // Get the buyer (the other participant in the chat room)
  const buyerId = chatRoom.participants.find(participantId => 
    participantId.toString() !== userId.toString()
  );

  if (!buyerId) {
    throw new BadRequestError("Could not identify buyer in chat room");
  }

  // Calculate total amount
  const totalAmount = item.itemPrice * quantitySold;

  // Start transaction to ensure data consistency
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create SoldItem record
    const soldItem = new SoldItem({
      item: item._id,
      seller: userId,
      buyer: buyerId,
      itemType: item.itemType,
      itemName: item.itemName,
      itemPrice: item.itemPrice,
      quantitySold: quantitySold,
      unit: item.unit,
      totalAmount: totalAmount,
      image: item.image,
      imagePublicId: item.imagePublicId,
    });

    await soldItem.save({ session });

    // Update item quantity
    const updatedItem = await Item.findByIdAndUpdate(
      item._id,
      { $inc: { quantity: -quantitySold } },
      { new: true, session }
    );

    // Create a "sold" message in the chat
    const soldMessage = new Message({
      chatRoomId,
      senderId: userId,
      messageType: "text",
      content: {
        text: `✅ Item marked as sold: ${quantitySold} ${item.unit} of ${item.itemName} for ₱${(item.itemPrice * quantitySold).toFixed(2)}. Remaining quantity: ${updatedItem.quantity} ${item.unit}`,
      },
    });

    await soldMessage.save({ session });
    await soldMessage.populate("senderId", "username profilePicture");

    // Update chat room last message
    await ChatRoom.findByIdAndUpdate(
      chatRoomId,
      {
        lastMessage: `Sold: ${quantitySold} ${item.unit} of ${item.itemName}`,
        lastMessageAt: new Date(),
      },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Item marked as sold successfully",
      data: {
        soldQuantity: quantitySold,
        remainingQuantity: updatedItem.quantity,
        totalPrice: totalAmount,
        soldItem: {
          _id: soldItem._id,
          itemName: soldItem.itemName,
          quantitySold: soldItem.quantitySold,
          unit: soldItem.unit,
          totalAmount: soldItem.totalAmount,
          saleDate: soldItem.saleDate,
        },
        soldMessage: soldMessage,
        updatedItem: {
          _id: updatedItem._id,
          itemName: updatedItem.itemName,
          quantity: updatedItem.quantity,
          unit: updatedItem.unit,
        },
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Update requested quantity in chat room
const updateRequestedQuantity = async (req, res) => {
  const { chatRoomId } = req.params;
  const { quantity } = req.body;
  const userId = req.user.userId;

  // Validate inputs
  if (!quantity || quantity <= 0) {
    throw new BadRequestError("Valid quantity is required");
  }

  // Get chat room with item details
  const chatRoom = await ChatRoom.findById(chatRoomId).populate("itemId");
  if (!chatRoom) {
    throw new NotFoundError("Chat room not found");
  }

  // Verify user is participant in this chat
  if (!chatRoom.participants.includes(userId)) {
    throw new UnauthorizedError("Not authorized to access this chat");
  }

  // Check if chat room has an associated item
  if (!chatRoom.itemId) {
    throw new BadRequestError("This chat room is not associated with any item");
  }

  const item = chatRoom.itemId;

  // Check if requested quantity exceeds available quantity
  if (quantity > item.quantity) {
    throw new BadRequestError(
      `Requested quantity (${quantity} ${item.unit}) exceeds available quantity (${item.quantity} ${item.unit})`
    );
  }

  // Update the requested quantity
  const oldQuantity = chatRoom.requestedQuantity;
  chatRoom.requestedQuantity = quantity;
  await chatRoom.save();

  // Create a message documenting the quantity change
  const quantityMessage = new Message({
    chatRoomId,
    senderId: userId,
    messageType: "text",
    content: {
      text: `📝 Updated requested quantity from ${oldQuantity} ${item.unit} to ${quantity} ${item.unit}`,
    },
  });

  await quantityMessage.save();
  await quantityMessage.populate("senderId", "username profilePicture");

  // Update chat room last message
  await ChatRoom.findByIdAndUpdate(chatRoomId, {
    lastMessage: `Updated quantity: ${quantity} ${item.unit}`,
    lastMessageAt: new Date(),
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Requested quantity updated successfully",
    data: {
      oldQuantity,
      newQuantity: quantity,
      unit: item.unit,
      quantityMessage: quantityMessage,
      updatedChatRoom: {
        _id: chatRoom._id,
        requestedQuantity: quantity,
        requestedUnit: item.unit,
      },
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
  markItemAsSold,
  updateRequestedQuantity,
};
