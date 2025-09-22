const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Schema = mongoose.Schema;

const accountSchema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, "Please provide a first name"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Please provide a last name"],
      trim: true,
    },
    username: {
      type: String,
      required: [true, "Please provide a username"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, "Please provide a birthdate"],
    },
    contactNo: {
      type: String,
      required: [true, "Please provide a contact number"],
      unique: true,
      match: [
        /^9\d{9}$/,
        "Please provide a valid Philippine phone number starting with 9",
      ],
    },
    address: {
      type: String,
      required: [true, "Please provide an address"],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      unique: true,
      required: [true, "Please provide an email"],
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minLength: [8, "Password must be at least 8 characters long"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin", "superadmin"],
      default: "buyer",
    },
    sellerApprovalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

accountSchema.pre("save", async function (next) {
  // Handle password hashing
  if (this.isModified("password")) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }

  // Set seller approval status based on role
  if (this.isModified("role")) {
    if (this.role === "seller") {
      this.sellerApprovalStatus = "pending";
    } else {
      // Clear seller approval fields for non-sellers
      this.sellerApprovalStatus = undefined;
      this.approvedBy = undefined;
      this.approvedAt = undefined;
    }
  }

  next();
});

accountSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

accountSchema.methods.isAdult = function () {
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age >= 18;
};

module.exports = mongoose.model("Account", accountSchema);
