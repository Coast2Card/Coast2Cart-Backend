const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const otpSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "OTP must be associated with a user"],
      index: true,
    },
    otp: {
      type: String,
      required: [true, "OTP code is required"],
      match: [/^\d+$/, "OTP must contain only digits"],
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
  },
  { timestamps: true }
);

// TTL index to automatically delete documents when expiresAt is reached
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OTP", otpSchema);



