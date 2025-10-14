const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const reviewSchema = new Schema(
  {
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Please specify the buyer creating the review"],
    },
    score: {
      type: Number,
      required: [true, "Please provide a review score"],
      min: [1, "Score must be at least 1"],
      max: [5, "Score cannot exceed 5"],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: "Score must be an integer between 1 and 5",
      },
    },
    reviewText: {
      type: String,
      trim: true,
      maxLength: [1000, "Review cannot exceed 1000 characters"],
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Please specify the seller being reviewed"],
      index: true,
    },
  },
  { timestamps: true }
);

// Helpful indexes
reviewSchema.index({ seller: 1, createdAt: -1 });
reviewSchema.index({ score: -1 });
reviewSchema.index({ buyer: 1 });

// Ensure virtual fields (if any in future) are serialized
reviewSchema.set("toJSON", { virtuals: true });
reviewSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Review", reviewSchema);



