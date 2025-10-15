const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    chatRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.01, "Quantity must be greater than 0"],
    },
    unit: {
      type: String,
      required: true,
      enum: ["kg", "pieces", "lbs", "grams"],
    },
    status: {
      type: String,
      enum: ["pending", "sold", "cancelled"],
      default: "pending",
    },
    priceAtTransaction: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    markedSoldAt: {
      type: Date,
    },
    markedSoldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
transactionSchema.index({ chatRoomId: 1, createdAt: -1 });
transactionSchema.index({ itemId: 1 });
transactionSchema.index({ buyerId: 1 });
transactionSchema.index({ sellerId: 1 });
transactionSchema.index({ status: 1 });

// Virtual for transaction summary
transactionSchema.virtual("summary").get(function () {
  return `${this.quantity} ${this.unit} - ₱${this.totalPrice.toFixed(2)}`;
});

// Ensure virtual fields are serialized
transactionSchema.set("toJSON", { virtuals: true });
transactionSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Transaction", transactionSchema);
