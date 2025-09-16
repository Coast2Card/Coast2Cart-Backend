require("dotenv").config();
const cloudinary = require("../config/cloudinary");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
  getOptimizedImageUrl,
} = require("../middleware/cloudinaryUpload");

/**
 * Test Cloudinary configuration
 */
const testCloudinaryConfig = () => {
  console.log("Testing Cloudinary configuration...");

  const config = cloudinary.config();
  console.log("Cloud Name:", config.cloud_name);
  console.log("API Key:", config.api_key ? "✓ Set" : "✗ Missing");
  console.log("API Secret:", config.api_secret ? "✓ Set" : "✗ Missing");

  if (config.cloud_name && config.api_key && config.api_secret) {
    console.log("✓ Cloudinary configuration is valid");
    return true;
  } else {
    console.log("✗ Cloudinary configuration is incomplete");
    return false;
  }
};

/**
 * Test public ID extraction
 */
const testPublicIdExtraction = () => {
  console.log("\nTesting public ID extraction...");

  const testUrl =
    "https://res.cloudinary.com/dzjn8brwg/image/upload/v1641234567/coast2cart/items/test-image.jpg";
  const publicId = extractPublicId(testUrl);

  console.log("Test URL:", testUrl);
  console.log("Extracted Public ID:", publicId);

  if (publicId === "coast2cart/items/test-image") {
    console.log("✓ Public ID extraction works correctly");
    return true;
  } else {
    console.log("✗ Public ID extraction failed");
    return false;
  }
};

/**
 * Test optimized URL generation
 */
const testOptimizedUrlGeneration = () => {
  console.log("\nTesting optimized URL generation...");

  const publicId = "coast2cart/items/test-image";
  const optimizedUrl = getOptimizedImageUrl(publicId, {
    width: 400,
    height: 300,
    crop: "limit",
  });

  console.log("Public ID:", publicId);
  console.log("Optimized URL:", optimizedUrl);

  if (
    optimizedUrl &&
    optimizedUrl.includes("res.cloudinary.com") &&
    optimizedUrl.includes("w_400")
  ) {
    console.log("✓ Optimized URL generation works correctly");
    return true;
  } else {
    console.log("✗ Optimized URL generation failed");
    return false;
  }
};

/**
 * Run all tests
 */
const runTests = () => {
  console.log("=== Cloudinary Integration Tests ===\n");

  const configTest = testCloudinaryConfig();
  const extractionTest = testPublicIdExtraction();
  const urlTest = testOptimizedUrlGeneration();

  console.log("\n=== Test Results ===");
  console.log("Configuration:", configTest ? "✓ PASS" : "✗ FAIL");
  console.log("Public ID Extraction:", extractionTest ? "✓ PASS" : "✗ FAIL");
  console.log("URL Generation:", urlTest ? "✓ PASS" : "✗ FAIL");

  const allPassed = configTest && extractionTest && urlTest;
  console.log(
    "\nOverall Result:",
    allPassed ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED"
  );

  return allPassed;
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testCloudinaryConfig,
  testPublicIdExtraction,
  testOptimizedUrlGeneration,
  runTests,
};
