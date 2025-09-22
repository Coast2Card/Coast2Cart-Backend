const axios = require("axios");

class PhilSMSService {
  constructor() {
    this.apiKey = process.env.PHILSMS_API_KEY;
    this.apiUrl = process.env.PHILSMS_API_URL;
    this.senderId = process.env.PHILSMS_SENDER_ID;

    // Check if required environment variables are set
    this.isConfigured = !!(this.apiKey && this.apiUrl && this.senderId);

    if (!this.isConfigured) {
      console.warn(
        "⚠️  PhilSMS service is not properly configured. Missing environment variables:"
      );
      if (!this.apiKey) console.warn("   - API key for PhilSMS");
      if (!this.apiUrl) console.warn("   - API URL for PhilSMS");
      if (!this.senderId) console.warn("   - Sender ID for PhilSMS");
      console.warn(
        "   Please set these environment variables to enable SMS functionality."
      );
    }
  }

  // Generate a random 6-digit OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via PhilSMS
   * @param {string} phoneNumber - The recipient's phone number
   * @param {string} otp - The OTP code to send
   * @returns {Promise<Object>} - Response from PhilSMS API
   */
  async sendOTP(phoneNumber, otp) {
    // Check if service is properly configured
    if (!this.isConfigured) {
      console.log("📱 PhilSMS not configured - OTP would be:", otp);
      return {
        success: false,
        error: "PhilSMS service not configured",
        message:
          "SMS service not available - please configure PhilSMS environment variables",
      };
    }

    try {
      // Format phone number for Philippines
      const formattedNumber = this.formatPhoneNumber(phoneNumber);

      const message = `Your Coast2Cart verification code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;

      const payload = {
        recipient: formattedNumber,
        sender_id: this.senderId,
        type: "plain",
        message: message,
      };

      const response = await axios.post(`${this.apiUrl}/sms/send`, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      return {
        success: true,
        data: response.data,
        message: "OTP sent successfully",
      };
    } catch (error) {
      console.error("PhilSMS Error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        message: "Failed to send OTP",
      };
    }
  }

  /**
   * Format phone number for Philippines
   * @param {string} phoneNumber - Raw phone number (starts with 9, e.g., 9123456789)
   * @returns {string} - Formatted phone number for PhilSMS API
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, "");

    // Since frontend sends numbers starting with 9 (e.g., 9123456789)
    // We need to add 63 prefix for PhilSMS API
    if (cleaned.startsWith("9") && cleaned.length === 10) {
      cleaned = "63" + cleaned;
    }
    // Handle edge cases if somehow other formats are sent
    else if (cleaned.startsWith("0")) {
      cleaned = "63" + cleaned.substring(1);
    } else if (!cleaned.startsWith("+63")) {
      cleaned = "63" + cleaned;
    }

    return cleaned;
  }

  /**
   * Verify if OTP is valid (not expired)
   * @param {string} storedOTP - OTP stored in database
   * @param {string} inputOTP - OTP entered by user
   * @param {Date} expiresAt - OTP expiration time
   * @returns {boolean} - Whether OTP is valid
   */
  verifyOTP(storedOTP, inputOTP, expiresAt) {
    const now = new Date();
    const isExpired = now > new Date(expiresAt);
    const isMatch = storedOTP === inputOTP;

    return !isExpired && isMatch;
  }
}

module.exports = new PhilSMSService();
