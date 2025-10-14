const jwt = require("jsonwebtoken");
const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");
const Accounts = require("../models/Accounts");

// Store active users
const activeUsers = new Map(); // userId -> socketId

const socketHandlers = (socket, io) => {
  // Middleware to authenticate socket connection
  socket.use((packet, next) => {
    const token = packet[1]?.token || socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  // Handle user connection
  socket.on("authenticate", async () => {
    try {
      // Store user as active
      activeUsers.set(socket.userId, socket.id);
      socket.userId = socket.userId;

      // Join user to their personal room for notifications
      socket.join(`user_${socket.userId}`);

      // Get user's chat rooms and join them
      const userChatRooms = await ChatRoom.find({
        participants: socket.userId,
      });

      userChatRooms.forEach((chatRoom) => {
        socket.join(`chat_${chatRoom._id}`);
      });

      // Notify user's contacts that they're online
      userChatRooms.forEach(async (chatRoom) => {
        const otherParticipant = chatRoom.participants.find(
          (id) => id.toString() !== socket.userId
        );

        if (otherParticipant) {
          const otherSocketId = activeUsers.get(otherParticipant.toString());
          if (otherSocketId) {
            io.to(otherSocketId).emit("user_status", {
              userId: socket.userId,
              isOnline: true,
            });
          }
        }
      });

      socket.emit("authenticated", {
        userId: socket.userId,
        message: "Successfully authenticated",
      });

      console.log(`User ${socket.userId} authenticated and connected`);
    } catch (error) {
      socket.emit("error", { message: "Authentication failed" });
    }
  });

  // Handle joining a chat room
  socket.on("join_chat", async (data) => {
    try {
      const { chatRoomId } = data;

      // Verify user is participant in this chat
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom || !chatRoom.participants.includes(socket.userId)) {
        return socket.emit("error", {
          message: "Not authorized to join this chat",
        });
      }

      socket.join(`chat_${chatRoomId}`);

      // Mark messages as read when joining
      await Message.updateMany(
        {
          chatRoomId: chatRoomId,
          senderId: { $ne: socket.userId },
          "readBy.userId": { $ne: socket.userId },
        },
        { $push: { readBy: { userId: socket.userId, readAt: new Date() } } }
      );

      // Update unread count
      await ChatRoom.findByIdAndUpdate(chatRoomId, {
        $set: { [`unreadCount.${socket.userId}`]: 0 },
      });

      socket.emit("joined_chat", { chatRoomId });
    } catch (error) {
      socket.emit("error", { message: "Failed to join chat" });
    }
  });

  // Handle sending messages
  socket.on("send_message", async (data) => {
    try {
      const { chatRoomId, messageType, content } = data;

      // Verify user is participant
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom || !chatRoom.participants.includes(socket.userId)) {
        return socket.emit("error", {
          message: "Not authorized to send message",
        });
      }

      // Handle product message - fetch product details if only productId is provided
      let messageContent = content;
      if (
        messageType === "product" &&
        content.productId &&
        !content.product?.name
      ) {
        const Item = require("../models/Item");
        const product = await Item.findById(content.productId);
        if (!product) {
          return socket.emit("error", { message: "Product not found" });
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
        senderId: socket.userId,
        messageType,
        content: messageContent,
        readBy: [{ userId: socket.userId, readAt: new Date() }],
      });

      await newMessage.save();

      // Populate sender info
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
        $inc: { [`unreadCount.${socket.userId}`]: 0 }, // Reset sender's unread
      });

      // Increment unread count for other participant
      const otherParticipant = chatRoom.participants.find(
        (id) => id.toString() !== socket.userId
      );

      if (otherParticipant) {
        await ChatRoom.findByIdAndUpdate(chatRoomId, {
          $inc: { [`unreadCount.${otherParticipant}`]: 1 },
        });
      }

      // Emit message to chat room
      io.to(`chat_${chatRoomId}`).emit("new_message", {
        message: newMessage,
        chatRoomId,
      });

      // Send notification to other participant if not in chat
      if (otherParticipant) {
        const otherSocketId = activeUsers.get(otherParticipant.toString());
        if (otherSocketId) {
          io.to(`user_${otherParticipant}`).emit("message_notification", {
            chatRoomId,
            message: newMessage,
            unreadCount: 1,
          });
        }
      }

      console.log(
        `Message sent in chat ${chatRoomId} by user ${socket.userId}`
      );
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Handle typing indicators
  socket.on("typing_start", (data) => {
    const { chatRoomId } = data;
    socket.to(`chat_${chatRoomId}`).emit("user_typing", {
      userId: socket.userId,
      isTyping: true,
    });
  });

  socket.on("typing_stop", (data) => {
    const { chatRoomId } = data;
    socket.to(`chat_${chatRoomId}`).emit("user_typing", {
      userId: socket.userId,
      isTyping: false,
    });
  });

  // Handle message read receipts
  socket.on("mark_read", async (data) => {
    try {
      const { messageId } = data;

      const message = await Message.findById(messageId);
      if (!message) {
        return socket.emit("error", { message: "Message not found" });
      }

      // Check if user is participant in this chat
      const chatRoom = await ChatRoom.findById(message.chatRoomId);
      if (!chatRoom || !chatRoom.participants.includes(socket.userId)) {
        return socket.emit("error", { message: "Not authorized" });
      }

      await message.markAsRead(socket.userId);

      // Emit read receipt to other participants
      socket.to(`chat_${message.chatRoomId}`).emit("message_read", {
        messageId,
        readBy: socket.userId,
        readAt: new Date(),
      });
    } catch (error) {
      socket.emit("error", { message: "Failed to mark message as read" });
    }
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    try {
      if (socket.userId) {
        // Remove from active users
        activeUsers.delete(socket.userId);

        // Notify contacts that user is offline
        const userChatRooms = await ChatRoom.find({
          participants: socket.userId,
        });

        userChatRooms.forEach(async (chatRoom) => {
          const otherParticipant = chatRoom.participants.find(
            (id) => id.toString() !== socket.userId
          );

          if (otherParticipant) {
            const otherSocketId = activeUsers.get(otherParticipant.toString());
            if (otherSocketId) {
              io.to(otherSocketId).emit("user_status", {
                userId: socket.userId,
                isOnline: false,
              });
            }
          }
        });

        console.log(`User ${socket.userId} disconnected`);
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });
};

module.exports = socketHandlers;
