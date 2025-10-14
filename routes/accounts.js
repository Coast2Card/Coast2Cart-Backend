const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/auth");
const { UnauthorizedError } = require("../errors");
const { validateProfileUpdate } = require("../middleware/validation");
const { uploadSingle } = require("../middleware/upload");
const { validateMulterImageOptional } = require("../middleware/validateMulterImage");
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
  getSellerInfo,
} = require("../controllers/accountController");

// All routes require authentication
router.use(authenticateToken);


router.post(
  "/admin",
  authorizeRoles("superadmin"),
  uploadSingle,
  validateMulterImageOptional,
  createAdminAccount
);

router.get("/admin", authorizeRoles("superadmin"), getAllAdminAccounts);

router.get("/admin/:adminId", authorizeRoles("superadmin"), getAdminAccount);

router.put("/admin/:adminId", authorizeRoles("superadmin"), updateAdminAccount);

router.delete("/admin/:adminId", authorizeRoles("superadmin"), deleteAdminAccount);


router.get(
  "/",
  authorizeRoles("admin", "superadmin"),
  (req, res, next) => {
    const { role } = req.query;
    if (role === "admin" && req.user.role !== "superadmin") {
      return next(new UnauthorizedError("Only superadmin can query admin accounts"));
    }
    return next();
  },
  getAllAccounts
);

router.get("/sellers/pending", authorizeRoles("admin", "superadmin"), getPendingSellerApprovals);

router.put("/sellers/:sellerId/approval", authorizeRoles("admin", "superadmin"), updateSellerApprovalStatus);

// Public seller info for authenticated users
router.get("/sellers/:sellerId/info", getSellerInfo);

router.get("/profile", getUserProfile);

router.put("/profile", validateProfileUpdate, updateUserProfile);

module.exports = router;
