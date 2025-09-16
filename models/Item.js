const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const itemSchema = new Schema(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Item must belong to a seller"],
    },
    itemType: {
      type: String,
      required: [true, "Please specify the item type"],
      enum: {
        values: ["fish", "souvenirs", "food"],
        message: "Item type must be either 'fish', 'souvenirs', or 'food'",
      },
    },
    itemName: {
      type: String,
      required: [true, "Please provide an item name"],
      trim: true,
      maxLength: [100, "Item name cannot exceed 100 characters"],
    },
    itemPrice: {
      type: Number,
      required: [true, "Please provide an item price"],
      min: [0.01, "Price must be greater than 0"],
    },
    quantity: {
      type: Number,
      required: [true, "Please provide the quantity available"],
      min: [0, "Quantity cannot be negative"],
    },
    unit: {
      type: String,
      required: [true, "Please specify the unit of measurement"],
      enum: {
        values: ["kg", "pieces", "lbs", "grams"],
        message: "Unit must be 'kg', 'pieces', 'lbs', or 'grams'",
      },
    },
    image: {
      type: String, // This will store the Cloudinary URL
      required: [true, "Please provide an item image"],
    },
    imagePublicId: {
      type: String, // Store Cloudinary public ID for image management
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    catchDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    location: {
      type: String,
      trim: true,
      maxLength: [100, "Location cannot exceed 100 characters"],
    },
  },
  { timestamps: true }
);

// Index for better query performance
itemSchema.index({ seller: 1, isActive: 1 });
itemSchema.index({ itemType: 1, isActive: 1 });
itemSchema.index({ catchDate: -1 });

// Virtual for formatted price
itemSchema.virtual("formattedPrice").get(function () {
  return `₱${this.itemPrice.toFixed(2)}`;
});

// Virtual for formatted quantity with unit
itemSchema.virtual("formattedQuantity").get(function () {
  return `${this.quantity} ${this.unit}`;
});

// Virtual for freshness indicator (for fish items)
itemSchema.virtual("isFresh").get(function () {
  if (this.itemType !== "fish") return null;

  const now = new Date();
  const hoursSinceCatch = (now - this.catchDate) / (1000 * 60 * 60);

  if (hoursSinceCatch <= 24) return "Very Fresh";
  if (hoursSinceCatch <= 48) return "Fresh";
  if (hoursSinceCatch <= 72) return "Good";
  return "Check Freshness";
});

// Ensure virtual fields are serialized
itemSchema.set("toJSON", { virtuals: true });
itemSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Item", itemSchema);
