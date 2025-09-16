const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const soldItemSchema = new Schema(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      required: [true, "Sold item must reference an original item"],
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Sold item must belong to a seller"],
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Sold item must have a buyer"],
    },
    itemType: {
      type: String,
      required: true,
      enum: ["fish", "souvenirs", "food"],
    },
    itemName: {
      type: String,
      required: true,
    },
    itemPrice: {
      type: Number,
      required: true,
    },
    quantitySold: {
      type: Number,
      required: [true, "Please specify the quantity sold"],
      min: [0.01, "Quantity sold must be greater than 0"],
    },
    unit: {
      type: String,
      required: true,
      enum: ["kg", "pieces", "lbs", "grams"],
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    imagePublicId: {
      type: String,
      required: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "pending", "cancelled"],
      default: "completed",
    },
    notes: {
      type: String,
      trim: true,
      maxLength: [200, "Notes cannot exceed 200 characters"],
    },
  },
  { timestamps: true }
);

// Index for better query performance
soldItemSchema.index({ seller: 1, saleDate: -1 });
soldItemSchema.index({ buyer: 1, saleDate: -1 });
soldItemSchema.index({ itemType: 1, saleDate: -1 });

// Virtual for formatted price
soldItemSchema.virtual("formattedPrice").get(function () {
  return `₱${this.itemPrice.toFixed(2)}`;
});

// Virtual for formatted total amount
soldItemSchema.virtual("formattedTotalAmount").get(function () {
  return `₱${this.totalAmount.toFixed(2)}`;
});

// Virtual for formatted quantity with unit
soldItemSchema.virtual("formattedQuantity").get(function () {
  return `${this.quantitySold} ${this.unit}`;
});

// Virtual for time since sale
soldItemSchema.virtual("timeSinceSale").get(function () {
  const now = new Date();
  const diffInMs = now - this.saleDate;
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours} hrs ago`;
  if (diffInDays === 1) return "1 day ago";
  return `${diffInDays} days ago`;
});

// Ensure virtual fields are serialized
soldItemSchema.set("toJSON", { virtuals: true });
soldItemSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("SoldItem", soldItemSchema);
