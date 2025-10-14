const Account = require("../models/Accounts");
const OTP = require("../models/OTP");
const jwt = require("jsonwebtoken");
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

// Derive permissions from current route authorizations
const getPermissionsForRole = (role) => {
  if (role === "superadmin") {
    return [
      "CREATE_ADMIN_ACCOUNT",
      "VIEW_ADMIN_ACCOUNTS",
      "UPDATE_ADMIN_ACCOUNT",
      "DELETE_ADMIN_ACCOUNT",
      "VIEW_ALL_ACCOUNTS",
      "VIEW_PENDING_SELLER_APPROVALS",
      "UPDATE_SELLER_APPROVAL_STATUS",
    ];
  }
  if (role === "admin") {
    return [
      "VIEW_ALL_ACCOUNTS",
      "VIEW_PENDING_SELLER_APPROVALS",
      "UPDATE_SELLER_APPROVAL_STATUS",
    ];
  }
  return [];
};

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
  // If a Bearer token is provided and belongs to an admin/superadmin,
  // we will tailor the success message accordingly (seller creation by admin)
  let isAdminCreator = false;
  try {
    const authHeader = req.headers && req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.userId) {
        const creator = await Account.findById(decoded.userId).select("role isVerified");
        if (creator && creator.isVerified && (creator.role === "admin" || creator.role === "superadmin")) {
          isAdminCreator = true;
        }
      }
    }
  } catch (_) {
    // Ignore token issues for public signup; proceed as unauthenticated creator
  }
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

  // Normalize contact number to canonical format
  const normalizedContact = philsmsService.normalizePhContact(contactNo);

  // Check for existing account with same username/email/contact
  const existingAccount = await Account.findOne({
    $or: [
      { username: username.toLowerCase() },
      { email: email.toLowerCase() },
      { contactNo: normalizedContact },
    ],
  });

  if (existingAccount) {
    if (!existingAccount.isVerified) {
      const err = new ConflictError(
        "Account exists but is not verified. Please verify your phone number first."
      );
      err.accountNotVerified = true;
      err.contactNo = existingAccount.contactNo;
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
    contactNo: normalizedContact,
    address,
    email: email.toLowerCase(),
    password,
    role,
    isVerified: false,
  };

  // Set seller status based on creation method
  if (role === "seller") {
    if (isAdminCreator) {
      // Admin-created seller: pending_otp (admin approved, waiting for OTP verification)
      accountData.status = "pending_otp";
    } else {
      // Signup-created seller: pending_otp_admin (waiting for both OTP and admin approval)
      accountData.status = "pending_otp_admin";
    }
  }

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
  const smsResult = await philsmsService.sendOTP(normalizedContact, otpCode);
  if (!smsResult.success) {
    // If SMS fails, still return success but log the error
    console.error("Failed to send OTP:", smsResult.error);
  }

  // Prepare response message based on role and creator
  let message = "Account created successfully. Please verify your phone number with the OTP sent.";
  if (role === "seller") {
    if (isAdminCreator) {
      message = "Seller account created successfully. An OTP was sent to the seller's phone for verification. After verification, the account will be reviewed by an administrator for approval.";
    } else {
      message += " After verification, your seller account will be reviewed by an administrator for approval.";
    }
  }

  res.status(201).json({
    success: true,
    message,
    data: {
      userId: account._id,
      contactNo: normalizedContact,
      email: account.email,
      role: account.role,
      ...(account.role === "seller" && { status: account.status }),
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
  const normalizedContact = philsmsService.normalizePhContact(contactNo);

  // Find account by contact number
  const account = await Account.findOne({ contactNo: normalizedContact });

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
  
  // Update seller status if this is a seller account
  if (account.role === "seller") {
    account.updateSellerStatus(true, account.status === "pending_otp");
  }
  
  await account.save();
  
  // Delete the used OTP
  await OTP.findByIdAndDelete(otpRecord._id);

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
  
  if (account.role === "seller") {
    userData.status = account.status;
  }

  // For seller accounts, do NOT return a token
  if (account.role === "seller") {
    return res.status(200).json({
      success: true,
      message: "Account verified successfully. Your seller account will be reviewed by an administrator.",
      data: {
        user: userData,
        status: account.status,
      },
    });
  }

  // Generate JWT token and return user data for immediate login (non-seller)
  const token = generateToken(account._id);

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

  // Normalize identifier if it may be a phone number
  const normalizedPhoneCandidate = philsmsService.normalizePhContact(identifier);

  // Find account by username, email, or contact number
  const account = await Account.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { email: normalizedIdentifier },
      { contactNo: normalizedPhoneCandidate },
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
    err.contactNo = account.contactNo;
    throw err;
  }

  // Check seller status for seller accounts
  if (account.role === "seller") {
    if (account.status === "pending_otp" || account.status === "pending_admin" || account.status === "pending_otp_admin") {
      throw new UnauthenticatedError(
        "Your seller account is pending approval. Please wait for administrator review."
      );
    }
    if (account.status === "rejected") {
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
  if (account.role === "admin" || account.role === "superadmin") {
    userData.permissions = getPermissionsForRole(account.role);
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
  const normalizedContact = philsmsService.normalizePhContact(contactNo);

  const account = await Account.findOne({ contactNo: normalizedContact });

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
  const smsResult = await philsmsService.sendOTP(normalizedContact, otpCode);
  if (!smsResult.success) {
    console.error("Failed to resend OTP:", smsResult.error);
  }

  res.status(200).json({
    success: true,
    message: "OTP resent successfully",
    smsSent: smsResult.success,
  });
});

/**
 * Request Password Reset (send OTP to contact number)
 */
const requestPasswordReset = asyncErrorHandler(async (req, res) => {
  const { contactNo } = req.body;
  const normalizedContact = philsmsService.normalizePhContact(contactNo);

  // Find account by contact number
  const account = await Account.findOne({ contactNo: normalizedContact });
  if (!account) {
    // Explicitly inform client that the number does not correspond to any account
    throw new NotFoundError("Account not found with this contact number");
  }

  // Generate new OTP
  const otpCode = philsmsService.generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Delete any existing OTPs for this user and create new one
  await OTP.deleteMany({ userId: account._id });
  await OTP.create({
    userId: account._id,
    otp: otpCode,
    expiresAt,
  });

  // Send OTP via PhilSMS
  const smsResult = await philsmsService.sendOTP(normalizedContact, otpCode);
  if (!smsResult.success) {
    console.error("Failed to send reset OTP:", smsResult.error);
  }

  res.status(200).json({
    success: true,
    message: "An OTP has been sent to the registered phone number.",
    smsSent: smsResult.success,
  });
});

/**
 * Reset Password (verify OTP and set new password)
 */
const resetPassword = asyncErrorHandler(async (req, res) => {
  const { contactNo, otp, newPassword } = req.body;
  const normalizedContact = philsmsService.normalizePhContact(contactNo);

  // Find account
  const account = await Account.findOne({ contactNo: normalizedContact });
  if (!account) {
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  // Find latest OTP
  const otpRecord = await OTP.findOne({ userId: account._id }).sort({ createdAt: -1 });
  if (!otpRecord) {
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  const isValidOTP = philsmsService.verifyOTP(otpRecord.otp, otp, otpRecord.expiresAt);
  if (!isValidOTP) {
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  // Update password
  account.password = newPassword;
  await account.save();

  // Delete the used OTP
  await OTP.findByIdAndDelete(otpRecord._id);

  res.status(200).json({ success: true, message: "Password has been reset successfully" });
});


module.exports = {
  signup, // Unified signup for buyers and sellers
  verifyOTP,
  login,
  resendOTP,
  requestPasswordReset,
  resetPassword,
};
