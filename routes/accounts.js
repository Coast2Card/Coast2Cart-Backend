const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/auth");
const { validateProfileUpdate } = require("../middleware/validation");
const {
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
} = require("../controllers/accountController");

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/accounts/admin
 * @desc    Create a new admin account (Superadmin only)
 * @access  Private (Superadmin)
 */
router.post("/admin", authorizeRoles("superadmin"), createAdminAccount);

/**
 * @route   GET /api/accounts/admin
 * @desc    Get all admin accounts with pagination and search (Superadmin only)
 * @access  Private (Superadmin)
 * @query   page, limit, search
 */
router.get("/admin", authorizeRoles("superadmin"), getAllAdminAccounts);

/**
 * @route   GET /api/accounts/admin/:adminId
 * @desc    Get single admin account by ID (Superadmin only)
 * @access  Private (Superadmin)
 */
router.get("/admin/:adminId", authorizeRoles("superadmin"), getAdminAccount);

/**
 * @route   PUT /api/accounts/admin/:adminId
 * @desc    Update admin account (Superadmin only)
 * @access  Private (Superadmin)
 */
router.put("/admin/:adminId", authorizeRoles("superadmin"), updateAdminAccount);

/**
 * @route   DELETE /api/accounts/admin/:adminId
 * @desc    Delete admin account (Superadmin only)
 * @access  Private (Superadmin)
 */
router.delete("/admin/:adminId", authorizeRoles("superadmin"), deleteAdminAccount);

/**
 * @route   GET /api/accounts
 * @desc    Get all accounts with pagination, search, and role filtering (Superadmin only)
 * @access  Private (Superadmin)
 * @query   page, limit, role, search
 */
router.get("/", authorizeRoles("superadmin"), getAllAccounts);

/**
 * @route   GET /api/accounts/sellers/pending
 * @desc    Get pending seller approvals (Admin/Superadmin only)
 * @access  Private (Admin/Superadmin)
 * @query   page, limit, search
 */
router.get("/sellers/pending", authorizeRoles("admin", "superadmin"), getPendingSellerApprovals);

/**
 * @route   PUT /api/accounts/sellers/:sellerId/approval
 * @desc    Update seller approval status (Admin/Superadmin only)
 * @access  Private (Admin/Superadmin)
 * @body    { status: "approved" | "rejected" }
 */
router.put("/sellers/:sellerId/approval", authorizeRoles("admin", "superadmin"), updateSellerApprovalStatus);

/**
 * @route   GET /api/accounts/profile
 * @desc    Get user profile (All authenticated users)
 * @access  Private (All roles)
 */
router.get("/profile", getUserProfile);

/**
 * @route   PUT /api/accounts/profile
 * @desc    Update user profile (All authenticated users can update their own profile)
 * @access  Private (All roles)
 * @body    { firstName?, lastName?, username?, dateOfBirth?, contactNo?, address?, email? }
 */
router.put("/profile", validateProfileUpdate, updateUserProfile);

module.exports = router;
