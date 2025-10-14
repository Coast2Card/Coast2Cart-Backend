/**
 * Seller Account Creation Flow - Test Script
 *
 * This script demonstrates the complete flow for admin-initiated seller account creation.
 *
 * Prerequisites:
 * 1. Server must be running on port 5000
 * 2. You need a valid admin or superadmin token
 * 3. Database must be accessible
 *
 * Flow:
 * 1. Admin creates seller account
 * 2. OTP is sent to seller's phone
 * 3. Seller verifies OTP
 * 4. Admin approves seller account
 */

const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:5000/api";
const ADMIN_TOKEN = "YOUR_ADMIN_TOKEN_HERE"; // Replace with actual admin token

// Test data
const sellerData = {
  firstName: "Juan",
  lastName: "Dela Cruz",
  username: "juandelacruz_seller",
  dateOfBirth: "1990-05-15",
  contactNo: "9123456789", // Use a valid test phone number
  address: "123 Test Street, Manila",
  email: "juan.delacruz@example.com",
  password: "SecurePass123!",
  confirmPassword: "SecurePass123!",
};

// Store data between steps
let sellerId = null;
let sellerContactNo = null;

/**
 * Step 1: Admin creates seller account
 */
async function createSellerAccount() {
  console.log("\n=== STEP 1: Admin Creates Seller Account ===\n");

  try {
    const response = await axios.post(
      `${BASE_URL}/accounts/seller`,
      sellerData,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
      }
    );

    console.log("✅ Seller account created successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));

    sellerId = response.data.data.sellerId;
    sellerContactNo = response.data.data.contactNo;

    console.log(`\n📱 OTP sent to: ${sellerContactNo}`);
    console.log(`📝 Seller ID: ${sellerId}`);
    console.log(`⚠️  Check server logs for OTP if PhilSMS is not configured\n`);

    return true;
  } catch (error) {
    console.error("❌ Error creating seller account:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Error:", error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * Step 2: Seller verifies OTP
 */
async function verifyOTP(otp) {
  console.log("\n=== STEP 2: Seller Verifies OTP ===\n");

  try {
    const response = await axios.post(
      `${BASE_URL}/auth/verify-otp`,
      {
        otp: otp,
        contactNo: sellerContactNo,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ OTP verified successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    console.log(
      "\n⏳ Seller account is now verified and pending admin approval\n"
    );

    return true;
  } catch (error) {
    console.error("❌ Error verifying OTP:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Error:", error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * Step 3: Get pending seller approvals
 */
async function getPendingSellerApprovals() {
  console.log("\n=== STEP 3: Admin Views Pending Seller Approvals ===\n");

  try {
    const response = await axios.get(`${BASE_URL}/accounts/sellers/pending`, {
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    });

    console.log("✅ Pending sellers retrieved successfully!");
    console.log(
      `📊 Total pending: ${response.data.data.pagination.totalPending}`
    );
    console.log(
      "Pending sellers:",
      JSON.stringify(response.data.data.pendingSellers, null, 2)
    );

    return true;
  } catch (error) {
    console.error("❌ Error getting pending sellers:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Error:", error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * Step 4: Admin approves seller account
 */
async function approveSellerAccount() {
  console.log("\n=== STEP 4: Admin Approves Seller Account ===\n");

  try {
    const response = await axios.put(
      `${BASE_URL}/accounts/sellers/${sellerId}/approval`,
      {
        status: "approved",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
      }
    );

    console.log("✅ Seller account approved successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    console.log("\n🎉 Seller can now log in to the platform!\n");

    return true;
  } catch (error) {
    console.error("❌ Error approving seller:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Error:", error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * Test seller login
 */
async function testSellerLogin() {
  console.log("\n=== STEP 5: Seller Attempts Login ===\n");

  try {
    const response = await axios.post(
      `${BASE_URL}/auth/login`,
      {
        identifier: sellerData.username,
        password: sellerData.password,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Seller logged in successfully!");
    console.log("User data:", JSON.stringify(response.data.data.user, null, 2));
    console.log(
      `\n🔑 Token received: ${response.data.data.token.substring(0, 20)}...\n`
    );

    return true;
  } catch (error) {
    console.error("❌ Error logging in:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Error:", error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * Helper: Resend OTP
 */
async function resendOTP() {
  console.log("\n=== Resending OTP ===\n");

  try {
    const response = await axios.post(
      `${BASE_URL}/auth/resend-otp`,
      {
        contactNo: sellerContactNo,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ OTP resent successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    console.log("⚠️  Check server logs for the new OTP\n");

    return true;
  } catch (error) {
    console.error("❌ Error resending OTP:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Error:", error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

// Main execution
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   SELLER ACCOUNT CREATION FLOW - INTEGRATION TEST          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Check if admin token is set
  if (ADMIN_TOKEN === "YOUR_ADMIN_TOKEN_HERE") {
    console.error(
      "\n❌ Please set a valid ADMIN_TOKEN in the script configuration\n"
    );
    console.log("To get an admin token:");
    console.log("1. Login as admin/superadmin: POST /api/auth/login");
    console.log("2. Copy the token from the response");
    console.log("3. Replace YOUR_ADMIN_TOKEN_HERE with the actual token\n");
    return;
  }

  // Step 1: Create seller account
  const step1Success = await createSellerAccount();
  if (!step1Success) {
    console.error("\n⚠️  Step 1 failed. Aborting test.\n");
    return;
  }

  // Wait for user to enter OTP
  console.log("───────────────────────────────────────────────────────────");
  console.log("⏸️  MANUAL STEP REQUIRED:");
  console.log("   1. Check the server logs or SMS for the OTP");
  console.log("   2. Enter the OTP when prompted");
  console.log("   3. Or call verifyOTP('123456') manually with the OTP\n");
  console.log("Example: await verifyOTP('123456')\n");
  console.log("To resend OTP: await resendOTP()\n");
  console.log("Once OTP is verified, call:");
  console.log("  - await getPendingSellerApprovals()");
  console.log("  - await approveSellerAccount()");
  console.log("  - await testSellerLogin()\n");
  console.log("───────────────────────────────────────────────────────────\n");

  // Export functions for manual testing
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      verifyOTP,
      resendOTP,
      getPendingSellerApprovals,
      approveSellerAccount,
      testSellerLogin,
    };
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  createSellerAccount,
  verifyOTP,
  resendOTP,
  getPendingSellerApprovals,
  approveSellerAccount,
  testSellerLogin,
};
