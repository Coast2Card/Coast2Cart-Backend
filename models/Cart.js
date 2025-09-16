const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Cart must belong to a user"],
    },
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
  },
  { timestamps: true }
);

// Index for better query performance
cartSchema.index({ user: 1, item: 1 }, { unique: true }); // One item per user in cart
cartSchema.index({ user: 1 });

// Virtual for formatted quantity
cartSchema.virtual("formattedQuantity").get(function () {
  return `${this.quantity} ${this.item?.unit || ""}`;
});

// Ensure virtual fields are serialized
cartSchema.set("toJSON", { virtuals: true });
cartSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Cart", cartSchema);
