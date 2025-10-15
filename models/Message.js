const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "product", "image", "file"],
      default: "text",
    },
    content: {
      text: {
        type: String,
        required: function () {
          return this.messageType === "text";
        },
      },
      product: {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Item",
        },
        name: String,
        description: String,
        price: String,
        image: String,
      },
      transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
      },
      quantity: Number,
      totalPrice: Number,
      imageUrl: {
        type: String,
        required: function () {
          return this.messageType === "image";
        },
      },
      fileName: {
        type: String,
        required: function () {
          return this.messageType === "file";
        },
      },
      fileUrl: {
        type: String,
        required: function () {
          return this.messageType === "file";
        },
      },
    },
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Account",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
messageSchema.index({ chatRoomId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ "readBy.userId": 1 });

// Virtual for read status
messageSchema.virtual("isRead").get(function () {
  return this.readBy.length > 0;
});

// Method to mark as read by user
messageSchema.methods.markAsRead = function (userId) {
  const existingRead = this.readBy.find(
    (read) => read.userId.toString() === userId.toString()
  );
  if (!existingRead) {
    this.readBy.push({
      userId: userId,
      readAt: new Date(),
    });
  }
  return this.save();
};

module.exports = mongoose.model("Message", messageSchema);
