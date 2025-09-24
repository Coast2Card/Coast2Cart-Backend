const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const cartItemSchema = new Schema({
  item: {
    type: Schema.Types.ObjectId,
    ref: "Item",
    required: [true, "Cart item must reference an item"],
  },
  quantity: {
    type: Number,
    required: [true, "Please specify the quantity"],
    min: [0.01, "Quantity must be greater than 0"],
  },
}, { _id: false });

const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Cart must belong to a user"],
      unique: true, // One cart per user
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

// Index for better query performance
cartSchema.index({ user: 1 }, { unique: true });

// Virtual for cart total
cartSchema.virtual("cartTotal").get(function () {
  return this.items.reduce((total, cartItem) => {
    return total + (cartItem.item?.itemPrice || 0) * cartItem.quantity;
  }, 0);
});

// Virtual for item count
cartSchema.virtual("itemCount").get(function () {
  return this.items.length;
});

// Virtual for seller count
cartSchema.virtual("sellerCount").get(function () {
  const sellerIds = new Set();
  this.items.forEach(cartItem => {
    if (cartItem.item?.seller) {
      sellerIds.add(cartItem.item.seller.toString());
    }
  });
  return sellerIds.size;
});

// Method to find item in cart
cartSchema.methods.findItem = function(itemId) {
  return this.items.find(cartItem => cartItem.item.toString() === itemId.toString());
};

// Method to add item to cart
cartSchema.methods.addItem = function(itemId, quantity) {
  const existingItem = this.findItem(itemId);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({ item: itemId, quantity });
  }
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const existingItem = this.findItem(itemId);
  if (existingItem) {
    existingItem.quantity = quantity;
  }
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(cartItem => cartItem.item.toString() !== itemId.toString());
};

// Method to clear all items
cartSchema.methods.clearItems = function() {
  this.items = [];
};

// Ensure virtual fields are serialized
cartSchema.set("toJSON", { virtuals: true });
cartSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Cart", cartSchema);
