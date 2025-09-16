const Account = require("../models/Accounts");
const {
  BadRequestError,
  UnauthenticatedError,
  UnauthorizedError,
  NotFoundError,
} = require("../errors");
const asyncErrorHandler = require("../middleware/asyncErrorHandler");
const { generateToken } = require("../middleware/auth");
const philsmsService = require("../services/philsmsService");

/**
 * Buyer Signup
 */
const buyerSignup = asyncErrorHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    username,
    dateOfBirth,
    contactNo,
    address,
    email,
    password,
    confirmPassword,
  } = req.body;

  // Create new buyer account
  const buyerData = {
    firstName,
    lastName,
    username: username.toLowerCase(),
    dateOfBirth,
    contactNo,
    address,
    email: email.toLowerCase(),
    password,
    role: "buyer",
    isVerified: false,
  };

  const account = await Account.create(buyerData);

  // Generate OTP
  const otp = philsmsService.generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store OTP in database
  account.otp = {
    code: otp,
    expiresAt: expiresAt,
  };
  await account.save();

  // Send OTP via PhilSMS
  const smsResult = await philsmsService.sendOTP(contactNo, otp);

  if (!smsResult.success) {
    // If SMS fails, still return success but log the error
    console.error("Failed to send OTP:", smsResult.error);
  }

  res.status(201).json({
    success: true,
    message:
      "Account created successfully. Please verify your phone number with the OTP sent.",
    data: {
      userId: account._id,
      contactNo: contactNo,
      email: account.email,
    },
    smsSent: smsResult.success,
  });
});

/**
 * Verify OTP
 */
const verifyOTP = asyncErrorHandler(async (req, res) => {
  const { otp, contactNo } = req.body;

  // Find account by contact number
  const account = await Account.findOne({ contactNo });

  if (!account) {
    throw new NotFoundError("Account not found with this contact number");
  }

  if (account.isVerified) {
    throw new BadRequestError("Account is already verified");
  }

  if (!account.otp || !account.otp.code) {
    throw new BadRequestError("No OTP found. Please request a new one");
  }

  // Verify OTP
  const isValidOTP = philsmsService.verifyOTP(
    account.otp.code,
    otp,
    account.otp.expiresAt
  );

  if (!isValidOTP) {
    throw new BadRequestError("Invalid or expired OTP");
  }

  // Mark account as verified and clear OTP
  account.isVerified = true;
  account.otp = undefined;
  await account.save();

  res.status(200).json({
    success: true,
    message: "Account verified successfully. You can now log in.",
    data: {
      userId: account._id,
      email: account.email,
      isVerified: account.isVerified,
    },
  });
});

/**
 * General Login (for all account types: buyer, seller, admin)
 */
const login = asyncErrorHandler(async (req, res) => {
  const { identifier, password } = req.body;

  // Find account by username, email, or contact number
  const account = await Account.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { email: identifier.toLowerCase() },
      { contactNo: identifier },
    ],
  });

  if (!account) {
    throw new UnauthenticatedError("Invalid credentials");
  }

  // Check if account is verified (required for all account types)
  if (!account.isVerified) {
    throw new UnauthenticatedError(
      "Account not verified. Please verify your phone number first."
    );
  }

  const isPasswordCorrect = await account.comparePassword(password);

  if (!isPasswordCorrect) {
    throw new UnauthenticatedError("Invalid credentials");
  }

  // Generate JWT token
  const token = generateToken(account._id);

  // Prepare user data based on account type
  const userData = {
    id: account._id,
    firstName: account.firstName,
    lastName: account.lastName,
    username: account.username,
    email: account.email,
    contactNo: account.contactNo,
    role: account.role,
    isVerified: account.isVerified,
  };

  // Add role-specific data
  if (account.role === "buyer") {
    userData.address = account.address;
    userData.dateOfBirth = account.dateOfBirth;
  }
  // Add more role-specific fields as needed for seller/admin

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: userData,
    },
  });

  console.log(
    `${account.role} ${account.username} has successfully logged in.`
  );
});

/**
 * Buyer Login (specific for buyer accounts)
 */
const buyerLogin = asyncErrorHandler(async (req, res) => {
  const { identifier, password } = req.body;

  // Find account by username, email, or contact number
  const account = await Account.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { email: identifier.toLowerCase() },
      { contactNo: identifier },
    ],
  });

  if (!account) {
    throw new UnauthenticatedError("Invalid credentials");
  }

  // Check if account is verified
  if (!account.isVerified) {
    throw new UnauthenticatedError(
      "Account not verified. Please verify your phone number first."
    );
  }

  // Check if account is a buyer
  if (account.role !== "buyer") {
    throw new UnauthenticatedError("This login is only for buyer accounts");
  }

  const isPasswordCorrect = await account.comparePassword(password);

  if (!isPasswordCorrect) {
    throw new UnauthenticatedError("Invalid credentials");
  }

  // Generate JWT token
  const token = generateToken(account._id);

  res.status(200).json({
    success: true,
    message: "Buyer login successful",
    data: {
      token,
      user: {
        id: account._id,
        firstName: account.firstName,
        lastName: account.lastName,
        username: account.username,
        email: account.email,
        contactNo: account.contactNo,
        address: account.address,
        dateOfBirth: account.dateOfBirth,
        role: account.role,
        isVerified: account.isVerified,
      },
    },
  });

  console.log(`Buyer ${account.username} has successfully logged in.`);
});

/**
 * Get User Profile (for all account types)
 */
const getUserProfile = asyncErrorHandler(async (req, res) => {
  const user = req.user;

  // Prepare user data based on account type
  const userData = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    contactNo: user.contactNo,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };

  // Add role-specific data
  if (user.role === "buyer") {
    userData.address = user.address;
    userData.dateOfBirth = user.dateOfBirth;
  }
  // Add more role-specific fields as needed for seller/admin

  res.status(200).json({
    success: true,
    data: {
      user: userData,
    },
  });
});

/**
 * Get Buyer Profile (specific for buyer accounts)
 */
const getBuyerProfile = asyncErrorHandler(async (req, res) => {
  const user = req.user;

  // Check if user is a buyer
  if (user.role !== "buyer") {
    throw new UnauthenticatedError("This profile is only for buyer accounts");
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        contactNo: user.contactNo,
        address: user.address,
        dateOfBirth: user.dateOfBirth,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    },
  });
});

/**
 * Resend OTP
 */
const resendOTP = asyncErrorHandler(async (req, res) => {
  const { contactNo } = req.body;

  const account = await Account.findOne({ contactNo });

  if (!account) {
    throw new NotFoundError("Account not found with this contact number");
  }

  if (account.isVerified) {
    throw new BadRequestError("Account is already verified");
  }

  // Generate new OTP
  const otp = philsmsService.generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Update OTP in database
  account.otp = {
    code: otp,
    expiresAt: expiresAt,
  };
  await account.save();

  // Send OTP via PhilSMS
  const smsResult = await philsmsService.sendOTP(contactNo, otp);

  if (!smsResult.success) {
    console.error("Failed to resend OTP:", smsResult.error);
  }

  res.status(200).json({
    success: true,
    message: "OTP resent successfully",
    smsSent: smsResult.success,
  });
});

module.exports = {
  buyerSignup,
  verifyOTP,
  login,
  buyerLogin, // Keep for backward compatibility
  getUserProfile,
  getBuyerProfile, // Keep for backward compatibility
  resendOTP,
};
