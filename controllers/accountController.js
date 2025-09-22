const Account = require("../models/Accounts");
const {
  BadRequestError,
  UnauthenticatedError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} = require("../errors");
const asyncErrorHandler = require("../middleware/asyncErrorHandler");
const philsmsService = require("../services/philsmsService");

/**
 * Create Admin Account (Superadmin only)
 */
const createAdminAccount = asyncErrorHandler(async (req, res) => {
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

  // Validate password confirmation
  if (password !== confirmPassword) {
    throw new BadRequestError("Passwords do not match");
  }

  // Check if username already exists
  const existingUsername = await Account.findOne({
    username: username.toLowerCase(),
  });
  if (existingUsername) {
    throw new ConflictError("Username already exists");
  }

  // Check if email already exists
  const existingEmail = await Account.findOne({
    email: email.toLowerCase(),
  });
  if (existingEmail) {
    throw new ConflictError("Email already exists");
  }

  // Check if contact number already exists
  const existingContact = await Account.findOne({ contactNo });
  if (existingContact) {
    throw new ConflictError("Contact number already exists");
  }

  // Create admin account data
  const adminData = {
    firstName,
    lastName,
    username: username.toLowerCase(),
    dateOfBirth,
    contactNo,
    address,
    email: email.toLowerCase(),
    password,
    role: "admin",
    isVerified: true, // Admin accounts are auto-verified
  };

  const account = await Account.create(adminData);

  res.status(201).json({
    success: true,
    message: "Admin account created successfully",
    data: {
      adminId: account._id,
      firstName: account.firstName,
      lastName: account.lastName,
      username: account.username,
      email: account.email,
      contactNo: account.contactNo,
      role: account.role,
      isVerified: account.isVerified,
      createdAt: account.createdAt,
    },
  });

  console.log(
    `Superadmin ${req.user.username} created admin account: ${account.username}`
  );
});

/**
 * Get All Admin Accounts (Superadmin only)
 */
const getAllAdminAccounts = asyncErrorHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "" } = req.query;

  // Build search query
  const searchQuery = {
    role: "admin",
    ...(search && {
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    }),
  };

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get admin accounts with pagination
  const adminAccounts = await Account.find(searchQuery)
    .select("-password -otp")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const totalAdmins = await Account.countDocuments(searchQuery);

  res.status(200).json({
    success: true,
    data: {
      admins: adminAccounts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalAdmins / parseInt(limit)),
        totalAdmins,
        hasNext: skip + adminAccounts.length < totalAdmins,
        hasPrev: parseInt(page) > 1,
      },
    },
  });
});

/**
 * Get Single Admin Account (Superadmin only)
 */
const getAdminAccount = asyncErrorHandler(async (req, res) => {
  const { adminId } = req.params;

  const adminAccount = await Account.findOne({
    _id: adminId,
    role: "admin",
  }).select("-password -otp");

  if (!adminAccount) {
    throw new NotFoundError("Admin account not found");
  }

  res.status(200).json({
    success: true,
    data: {
      admin: adminAccount,
    },
  });
});

/**
 * Update Admin Account (Superadmin only)
 */
const updateAdminAccount = asyncErrorHandler(async (req, res) => {
  const { adminId } = req.params;
  const {
    firstName,
    lastName,
    username,
    dateOfBirth,
    contactNo,
    address,
    email,
  } = req.body;

  const adminAccount = await Account.findOne({
    _id: adminId,
    role: "admin",
  });

  if (!adminAccount) {
    throw new NotFoundError("Admin account not found");
  }

  // Check for conflicts if updating unique fields
  if (username && username.toLowerCase() !== adminAccount.username) {
    const existingUsername = await Account.findOne({
      username: username.toLowerCase(),
      _id: { $ne: adminId },
    });
    if (existingUsername) {
      throw new ConflictError("Username already exists");
    }
  }

  if (email && email.toLowerCase() !== adminAccount.email) {
    const existingEmail = await Account.findOne({
      email: email.toLowerCase(),
      _id: { $ne: adminId },
    });
    if (existingEmail) {
      throw new ConflictError("Email already exists");
    }
  }

  if (contactNo && contactNo !== adminAccount.contactNo) {
    const existingContact = await Account.findOne({
      contactNo,
      _id: { $ne: adminId },
    });
    if (existingContact) {
      throw new ConflictError("Contact number already exists");
    }
  }

  // Update fields
  if (firstName) adminAccount.firstName = firstName;
  if (lastName) adminAccount.lastName = lastName;
  if (username) adminAccount.username = username.toLowerCase();
  if (dateOfBirth) adminAccount.dateOfBirth = dateOfBirth;
  if (contactNo) adminAccount.contactNo = contactNo;
  if (address) adminAccount.address = address;
  if (email) adminAccount.email = email.toLowerCase();

  await adminAccount.save();

  res.status(200).json({
    success: true,
    message: "Admin account updated successfully",
    data: {
      admin: {
        id: adminAccount._id,
        firstName: adminAccount.firstName,
        lastName: adminAccount.lastName,
        username: adminAccount.username,
        email: adminAccount.email,
        contactNo: adminAccount.contactNo,
        address: adminAccount.address,
        dateOfBirth: adminAccount.dateOfBirth,
        role: adminAccount.role,
        isVerified: adminAccount.isVerified,
        updatedAt: adminAccount.updatedAt,
      },
    },
  });

  console.log(
    `Superadmin ${req.user.username} updated admin account: ${adminAccount.username}`
  );
});

/**
 * Delete Admin Account (Superadmin only)
 */
const deleteAdminAccount = asyncErrorHandler(async (req, res) => {
  const { adminId } = req.params;

  const adminAccount = await Account.findOne({
    _id: adminId,
    role: "admin",
  });

  if (!adminAccount) {
    throw new NotFoundError("Admin account not found");
  }

  await Account.findByIdAndDelete(adminId);

  res.status(200).json({
    success: true,
    message: "Admin account deleted successfully",
  });

  console.log(
    `Superadmin ${req.user.username} deleted admin account: ${adminAccount.username}`
  );
});


/**
 * Get All Accounts (Superadmin only) - For comprehensive account management
 */
const getAllAccounts = asyncErrorHandler(async (req, res) => {
  const { page = 1, limit = 10, role = "", search = "" } = req.query;

  // Build search query
  const searchQuery = {
    ...(role && { role }),
    ...(search && {
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    }),
  };

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get accounts with pagination
  const accounts = await Account.find(searchQuery)
    .select("-password -otp")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const totalAccounts = await Account.countDocuments(searchQuery);

  // Get role counts
  const roleCounts = await Account.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      accounts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalAccounts / parseInt(limit)),
        totalAccounts,
        hasNext: skip + accounts.length < totalAccounts,
        hasPrev: parseInt(page) > 1,
      },
      roleCounts: roleCounts.reduce((acc, role) => {
        acc[role._id] = role.count;
        return acc;
      }, {}),
    },
  });
});

/**
 * Get Pending Seller Approvals (Admin/Superadmin only)
 */
const getPendingSellerApprovals = asyncErrorHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "" } = req.query;

  // Build search query for pending sellers
  const searchQuery = {
    role: "seller",
    sellerApprovalStatus: "pending",
    isVerified: true, // Only show verified accounts
    ...(search && {
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    }),
  };

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get pending sellers with pagination
  const pendingSellers = await Account.find(searchQuery)
    .select("-password -otp")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const totalPending = await Account.countDocuments(searchQuery);

  res.status(200).json({
    success: true,
    data: {
      pendingSellers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPending / parseInt(limit)),
        totalPending,
        hasNext: skip + pendingSellers.length < totalPending,
        hasPrev: parseInt(page) > 1,
      },
    },
  });
});

/**
 * Update Seller Approval Status (Admin/Superadmin only)
 */
const updateSellerApprovalStatus = asyncErrorHandler(async (req, res) => {
  const { sellerId } = req.params;
  const { status } = req.body;

  // Validate status
  if (!status || !["approved", "rejected"].includes(status)) {
    throw new BadRequestError("Status must be either 'approved' or 'rejected'");
  }

  const sellerAccount = await Account.findOne({
    _id: sellerId,
    role: "seller",
    sellerApprovalStatus: "pending",
  });

  if (!sellerAccount) {
    throw new NotFoundError("Pending seller account not found");
  }

  // Update seller approval status
  sellerAccount.sellerApprovalStatus = status;
  sellerAccount.approvedBy = req.user._id;
  sellerAccount.approvedAt = new Date();
  await sellerAccount.save();

  const action = status === "approved" ? "approved" : "rejected";
  const message = `Seller account ${action} successfully`;

  res.status(200).json({
    success: true,
    message,
    data: {
      seller: {
        id: sellerAccount._id,
        firstName: sellerAccount.firstName,
        lastName: sellerAccount.lastName,
        username: sellerAccount.username,
        email: sellerAccount.email,
        sellerApprovalStatus: sellerAccount.sellerApprovalStatus,
        approvedBy: sellerAccount.approvedBy,
        approvedAt: sellerAccount.approvedAt,
      },
    },
  });

  console.log(
    `${req.user.role} ${req.user.username} ${action} seller account: ${sellerAccount.username}`
  );
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
 * Update User Profile (for all account types - users can only update their own profile)
 */
const updateUserProfile = asyncErrorHandler(async (req, res) => {
  const user = req.user;
  const {
    firstName,
    lastName,
    username,
    dateOfBirth,
    contactNo,
    address,
    email,
  } = req.body;

  // Get the user's account from database
  const userAccount = await Account.findById(user._id);

  if (!userAccount) {
    throw new NotFoundError("User account not found");
  }

  // Check for conflicts if updating unique fields
  if (username && username.toLowerCase() !== userAccount.username) {
    const existingUsername = await Account.findOne({
      username: username.toLowerCase(),
      _id: { $ne: user._id },
    });
    if (existingUsername) {
      throw new ConflictError("Username already exists");
    }
  }

  if (email && email.toLowerCase() !== userAccount.email) {
    const existingEmail = await Account.findOne({
      email: email.toLowerCase(),
      _id: { $ne: user._id },
    });
    if (existingEmail) {
      throw new ConflictError("Email already exists");
    }
  }

  if (contactNo && contactNo !== userAccount.contactNo) {
    const existingContact = await Account.findOne({
      contactNo,
      _id: { $ne: user._id },
    });
    if (existingContact) {
      throw new ConflictError("Contact number already exists");
    }
  }

  // Update fields if provided
  if (firstName) userAccount.firstName = firstName;
  if (lastName) userAccount.lastName = lastName;
  if (username) userAccount.username = username.toLowerCase();
  if (dateOfBirth) userAccount.dateOfBirth = dateOfBirth;
  if (contactNo) userAccount.contactNo = contactNo;
  if (address) userAccount.address = address;
  if (email) userAccount.email = email.toLowerCase();

  await userAccount.save();

  // Prepare updated user data
  const updatedUserData = {
    id: userAccount._id,
    firstName: userAccount.firstName,
    lastName: userAccount.lastName,
    username: userAccount.username,
    email: userAccount.email,
    contactNo: userAccount.contactNo,
    role: userAccount.role,
    isVerified: userAccount.isVerified,
    updatedAt: userAccount.updatedAt,
  };

  // Add role-specific data
  if (userAccount.role === "buyer") {
    updatedUserData.address = userAccount.address;
    updatedUserData.dateOfBirth = userAccount.dateOfBirth;
  }

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: updatedUserData,
    },
  });

  console.log(`User ${userAccount.username} updated their profile`);
});

module.exports = {
  createAdminAccount,
  getAllAdminAccounts,
  getAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
  getAllAccounts,
  getPendingSellerApprovals,
  updateSellerApprovalStatus,
  getUserProfile,
  updateUserProfile,
};
