const Account = require("../models/Accounts");
const OTP = require("../models/OTP");
const {
  BadRequestError,
  UnauthenticatedError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
} = require("../errors");
const asyncErrorHandler = require("../middleware/asyncErrorHandler");
const { generateToken } = require("../middleware/auth");
const philsmsService = require("../services/philsmsService");

/**
 * Normalize email address (same logic as express-validator's normalizeEmail)
 */
const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  
  const [localPart, domain] = email.toLowerCase().split('@');
  
  // Only normalize Gmail and Googlemail domains
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Remove periods from local part
    const normalizedLocal = localPart.replace(/\./g, '');
    return `${normalizedLocal}@${domain}`;
  }
  
  return email.toLowerCase();
};

/**
 * Unified Signup (for buyers and sellers)
 */
const signup = asyncErrorHandler(async (req, res) => {
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
    role,
  } = req.body;

  // Validate role
  if (!role || !["buyer", "seller"].includes(role)) {
    throw new BadRequestError("Role must be either 'buyer' or 'seller'");
  }

  // Validate password confirmation
  if (password !== confirmPassword) {
    throw new BadRequestError("Passwords do not match");
  }

  // Check for existing account with same username/email/contact
  const existingAccount = await Account.findOne({
    $or: [
      { username: username.toLowerCase() },
      { email: email.toLowerCase() },
      { contactNo: contactNo },
    ],
  });

  if (existingAccount) {
    if (!existingAccount.isVerified) {
      const err = new ConflictError(
        "Account exists but is not verified. Please verify your phone number first."
      );
      err.accountNotVerified = true;
      throw err;
    }
    throw new ConflictError(
      "Account with the provided username, email, or contact number already exists"
    );
  }

  // Create new account data
  const accountData = {
    firstName,
    lastName,
    username: username.toLowerCase(),
    dateOfBirth,
    contactNo,
    address,
    email: email.toLowerCase(),
    password,
    role,
    isVerified: false,
  };

  const account = await Account.create(accountData);

  // Generate OTP
  const otpCode = philsmsService.generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store OTP in separate collection
  await OTP.create({
    userId: account._id,
    otp: otpCode,
    expiresAt: expiresAt,
  });

  // Send OTP via PhilSMS
  const smsResult = await philsmsService.sendOTP(contactNo, otpCode);
  if (!smsResult.success) {
    // If SMS fails, still return success but log the error
    console.error("Failed to send OTP:", smsResult.error);
  }

  // Prepare response message based on role
  let message = "Account created successfully. Please verify your phone number with the OTP sent.";
  if (role === "seller") {
    message += " After verification, your seller account will be reviewed by an administrator for approval.";
  }

  res.status(201).json({
    success: true,
    message,
    data: {
      userId: account._id,
      contactNo: contactNo,
      email: account.email,
      role: account.role,
      ...(account.role === "seller" && { sellerApprovalStatus: account.sellerApprovalStatus }),
    },
    smsSent: smsResult.success,
  });

  console.log(`${role} account created: ${account.username}`);
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

  // Find the OTP for this user
  const otpRecord = await OTP.findOne({ userId: account._id }).sort({ createdAt: -1 });
  
  if (!otpRecord) {
    throw new BadRequestError("No OTP found. Please request a new one");
  }

  // Verify OTP
  const isValidOTP = philsmsService.verifyOTP(
    otpRecord.otp,
    otp,
    otpRecord.expiresAt
  );

  if (!isValidOTP) {
    throw new BadRequestError("Invalid or expired OTP");
  }

  // Mark account as verified and delete the OTP record
  account.isVerified = true;
  await account.save();
  
  // Delete the used OTP
  await OTP.findByIdAndDelete(otpRecord._id);

  // Generate JWT token and return user data for immediate login
  const token = generateToken(account._id);

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

  if (account.role === "buyer") {
    userData.address = account.address;
    userData.dateOfBirth = account.dateOfBirth;
  }

  res.status(200).json({
    success: true,
    message: "Account verified successfully. Login successful",
    data: {
      token,
      user: userData,
    },
  });
});

/**
 * General Login (for all account types: buyer, seller, admin)
 */
const login = asyncErrorHandler(async (req, res) => {
  const { identifier, password } = req.body;

  // Normalize email if it looks like an email address
  let normalizedIdentifier = identifier.toLowerCase();
  if (identifier.includes('@')) {
    // Apply the same normalization as in registration
    normalizedIdentifier = normalizeEmail(identifier);
  }

  // Find account by username, email, or contact number
  const account = await Account.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { email: normalizedIdentifier },
      { contactNo: identifier },
    ],
  });

  if (!account) {
    throw new NotFoundError("Account does not exist");
  }

  // Check if account is verified (required for all account types)
  if (!account.isVerified) {
    const err = new UnauthenticatedError(
      "Account not verified. Please verify your phone number first."
    );
    err.accountNotVerified = true;
    throw err;
  }

  // Check seller approval status for seller accounts
  if (account.role === "seller") {
    if (account.sellerApprovalStatus === "pending") {
      throw new UnauthenticatedError(
        "Your seller account is pending approval. Please wait for administrator review."
      );
    }
    if (account.sellerApprovalStatus === "rejected") {
      throw new UnauthenticatedError(
        "Your seller account has been rejected. Please contact support for more information."
      );
    }
  }

  const isPasswordCorrect = await account.comparePassword(password);

  if (!isPasswordCorrect) {
    throw new UnauthenticatedError("Invalid username/email/phone number and password");
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

  // Enforce 5-minute cooldown: block resend if an unexpired OTP exists
  const lastOtp = await OTP.findOne({ userId: account._id }).sort({ createdAt: -1 });
  if (lastOtp && lastOtp.expiresAt && lastOtp.expiresAt > new Date()) {
    const remainingSeconds = Math.ceil((lastOtp.expiresAt.getTime() - Date.now()) / 1000);
    throw new TooManyRequestsError(
      `Please wait ${remainingSeconds} seconds before requesting a new OTP`
    );
  }

  // Generate new OTP
  const otpCode = philsmsService.generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Delete any existing OTPs for this user and create new one
  await OTP.deleteMany({ userId: account._id });
  await OTP.create({
    userId: account._id,
    otp: otpCode,
    expiresAt: expiresAt,
  });

  // Send OTP via PhilSMS
  const smsResult = await philsmsService.sendOTP(contactNo, otpCode);
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
  signup, // Unified signup for buyers and sellers
  verifyOTP,
  login,
  resendOTP,
};
