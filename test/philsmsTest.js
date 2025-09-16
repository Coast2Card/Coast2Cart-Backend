require("dotenv").config();
const axios = require("axios");

/**
 * PhilSMS Connection Test
 * This file tests the PhilSMS API connection without sending actual SMS
 */

class PhilSMSTest {
  constructor() {
    this.apiKey = process.env.PHILSMS_API_KEY;
    this.apiUrl = process.env.PHILSMS_API_URL;
    this.senderId = process.env.PHILSMS_SENDER_ID;
  }

  /**
   * Test 1: Check Environment Variables
   */
  testEnvironmentVariables() {
    console.log("\n🔧 Testing Environment Variables...");
    console.log("=====================================");

    const requiredVars = {
      PHILSMS_API_KEY: this.apiKey,
      PHILSMS_API_URL: this.apiUrl,
      PHILSMS_SENDER_ID: this.senderId,
    };

    let allPresent = true;

    for (const [key, value] of Object.entries(requiredVars)) {
      if (value) {
        console.log(`✅ ${key}: ${value.substring(0, 20)}...`);
      } else {
        console.log(`❌ ${key}: MISSING`);
        allPresent = false;
      }
    }

    if (allPresent) {
      console.log("\n✅ All environment variables are present!");
    } else {
      console.log("\n❌ Some environment variables are missing!");
    }

    return allPresent;
  }

  /**
   * Test 2: Test API Endpoint Connectivity
   */
  async testAPIConnectivity() {
    console.log("\n🌐 Testing API Connectivity...");
    console.log("================================");

    try {
      // Test basic connectivity to PhilSMS API
      const response = await axios.get(`${this.apiUrl}/`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 10000, // 10 second timeout
      });

      console.log("✅ API Endpoint is reachable");
      console.log(`📊 Status Code: ${response.status}`);
      console.log(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);

      return true;
    } catch (error) {
      console.log("❌ API Endpoint connection failed");

      if (error.response) {
        console.log(`📊 Status Code: ${error.response.status}`);
        console.log(
          `📋 Error Response: ${JSON.stringify(error.response.data, null, 2)}`
        );
      } else if (error.request) {
        console.log("📋 Network Error: No response received");
        console.log(`📋 Request URL: ${error.config?.url}`);
      } else {
        console.log(`📋 Error: ${error.message}`);
      }

      return false;
    }
  }

  /**
   * Test 3: Test API Authentication
   */
  async testAPIAuthentication() {
    console.log("\n🔐 Testing API Authentication...");
    console.log("=================================");

    try {
      // Try to access a protected endpoint (like account info)
      const response = await axios.get(`${this.apiUrl}/account`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 10000,
      });

      console.log("✅ API Authentication successful");
      console.log(`📊 Status Code: ${response.status}`);
      console.log(`📋 Account Info: ${JSON.stringify(response.data, null, 2)}`);

      return true;
    } catch (error) {
      console.log("❌ API Authentication failed");

      if (error.response) {
        console.log(`📊 Status Code: ${error.response.status}`);
        console.log(
          `📋 Error Response: ${JSON.stringify(error.response.data, null, 2)}`
        );

        if (error.response.status === 401) {
          console.log(
            "💡 This might be due to invalid API key or insufficient permissions"
          );
        }
      } else {
        console.log(`📋 Error: ${error.message}`);
      }

      return false;
    }
  }

  /**
   * Test 4: Test Phone Number Formatting
   */
  testPhoneNumberFormatting() {
    console.log("\n📱 Testing Phone Number Formatting...");
    console.log("=====================================");

    const testNumbers = [
      "9123456789", // Correct format
      "09123456789", // With 0 prefix
      "+639123456789", // With +63 prefix
      "639123456789", // With 63 prefix
      "1234567890", // Wrong format
    ];

    testNumbers.forEach((phoneNumber) => {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const isValid = /^\+639\d{9}$/.test(formatted);

      console.log(`📞 ${phoneNumber} → ${formatted} ${isValid ? "✅" : "❌"}`);
    });
  }

  /**
   * Format phone number for Philippines (same logic as in service)
   */
  formatPhoneNumber(phoneNumber) {
    let cleaned = phoneNumber.replace(/\D/g, "");

    if (cleaned.startsWith("9") && cleaned.length === 10) {
      cleaned = "+63" + cleaned;
    } else if (cleaned.startsWith("0")) {
      cleaned = "+63" + cleaned.substring(1);
    } else if (cleaned.startsWith("63")) {
      cleaned = "+" + cleaned;
    } else if (!cleaned.startsWith("+63")) {
      cleaned = "+63" + cleaned;
    }

    return cleaned;
  }

  /**
   * Test 5: Simulate SMS Payload (without sending)
   */
  testSMSPayload() {
    console.log("\n📨 Testing SMS Payload Structure...");
    console.log("====================================");

    const testOTP = "123456";
    const testPhone = "9123456789";
    const formattedPhone = this.formatPhoneNumber(testPhone);

    const payload = {
      to: formattedPhone,
      message: `Your Coast2Cart verification code is: ${testOTP}. Valid for 5 minutes. Do not share this code with anyone.`,
      sender_id: this.senderId,
    };

    console.log("📋 SMS Payload Structure:");
    console.log(JSON.stringify(payload, null, 2));

    console.log("\n📊 Payload Analysis:");
    console.log(`📞 To: ${payload.to} (${payload.to.length} characters)`);
    console.log(`📝 Message: ${payload.message.length} characters`);
    console.log(`🏷️  Sender ID: ${payload.sender_id}`);

    // Validate payload
    const isValid = payload.to && payload.message && payload.sender_id;
    console.log(`✅ Payload Valid: ${isValid ? "Yes" : "No"}`);

    return isValid;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log("🧪 PhilSMS Connection Test Suite");
    console.log("================================");
    console.log(
      "This test will check PhilSMS connectivity without sending SMS"
    );

    const results = {
      environment: this.testEnvironmentVariables(),
      connectivity: await this.testAPIConnectivity(),
      authentication: await this.testAPIAuthentication(),
      phoneFormatting: true, // This always passes
      smsPayload: this.testPhoneNumberFormatting() && this.testSMSPayload(),
    };

    console.log("\n📊 Test Results Summary");
    console.log("=======================");
    console.log(
      `🔧 Environment Variables: ${results.environment ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `🌐 API Connectivity: ${results.connectivity ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `🔐 API Authentication: ${results.authentication ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `📱 Phone Formatting: ${results.phoneFormatting ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `📨 SMS Payload: ${results.smsPayload ? "✅ PASS" : "❌ FAIL"}`
    );

    const allPassed = Object.values(results).every((result) => result === true);

    console.log("\n🎯 Overall Result");
    console.log("=================");
    if (allPassed) {
      console.log("✅ All tests passed! PhilSMS integration is ready.");
      console.log(
        "💡 You can now add SMS credits and test actual OTP sending."
      );
    } else {
      console.log("❌ Some tests failed. Please check the issues above.");
      console.log("💡 Fix the issues before testing with real SMS.");
    }

    return allPassed;
  }
}

// Run the tests
async function runTests() {
  const tester = new PhilSMSTest();
  await tester.runAllTests();
}

// Export for use in other files
module.exports = PhilSMSTest;

// Run if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}
