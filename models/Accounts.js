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
      sparse: true, // Allows multiple null values (for sellers without email)
      required: false, // Email is optional (especially for digital illiterate sellers)
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
    status: {
      type: String,
      enum: [
        "pending_otp",           // Account created, waiting for OTP verification
        "pending_admin",         // OTP verified, waiting for admin approval
        "pending_otp_admin",     // Admin approved, waiting for OTP verification
        "validated",             // Both OTP and admin approval completed
        "rejected"               // Rejected by admin
      ],
      default: "pending_otp",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    approvedAt: {
      type: Date,
    },
    profilePicture: {
      type: String, // Cloudinary URL
    },
    profilePicturePublicId: {
      type: String, // Cloudinary public ID for deletion
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

  // Set seller status based on role
  if (this.isModified("role")) {
    if (this.role === "seller") {
      // status will be set explicitly in the creation logic
    } else {
      // Clear seller status fields for non-sellers
      this.status = undefined;
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

/**
 * Update seller status based on OTP verification and admin approval
 * @param {boolean} isOTPVerified - Whether OTP is verified
 * @param {boolean} isAdminApproved - Whether admin has approved
 */
accountSchema.methods.updateSellerStatus = function(isOTPVerified, isAdminApproved) {
  if (this.role !== "seller") return;
  
  if (isOTPVerified && isAdminApproved) {
    this.status = "validated";
  } else if (isOTPVerified && !isAdminApproved) {
    this.status = "pending_admin"; // OTP verified, waiting for admin approval
  } else if (!isOTPVerified && isAdminApproved) {
    this.status = "pending_otp"; // Admin approved, waiting for OTP verification
  } else {
    this.status = "pending_otp_admin"; // Waiting for both OTP and admin approval
  }
};

module.exports = mongoose.model("Account", accountSchema);
