const mongoose = require("mongoose");

const chatRoomSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: true,
      },
    ],
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: false, // Optional - for item-specific chats
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    requestedQuantity: {
      type: Number,
      default: 1, // Default to 1 if not specified
    },
    requestedUnit: {
      type: String,
      default: null, // Will be populated from the item's unit
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ itemId: 1 });
chatRoomSchema.index({ lastMessageAt: -1 });

// Ensure only 2 participants per chat room
chatRoomSchema.pre("save", function (next) {
  if (this.participants.length !== 2) {
    return next(new Error("Chat room must have exactly 2 participants"));
  }

  // Sort participants for consistent ordering
  this.participants.sort();
  next();
});

// Virtual to get other participant
chatRoomSchema.virtual("otherParticipant", {
  ref: "Account",
  localField: "participants",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("ChatRoom", chatRoomSchema);
