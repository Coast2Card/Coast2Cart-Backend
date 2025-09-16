require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { connectDB } = require("../db/connect");
const Item = require("../models/Item");
const Account = require("../models/Accounts");
const { uploadToCloudinary } = require("../middleware/cloudinaryUpload");

/**
 * Test item creation with image upload
 */
const testItemCreation = async () => {
  try {
    console.log("=== Testing Item Creation with Cloudinary ===\n");

    // Connect to database
    await connectDB(process.env.MONGODB_URI);
    console.log("✓ Connected to database");

    // Create a test seller account
    const testSeller = new Account({
      firstName: "Test",
      lastName: "Seller",
      username: "testseller",
      dateOfBirth: new Date("1990-01-01"),
      contactNo: "9123456789",
      address: "Test Address, Test City",
      email: "testseller@example.com",
      password: "TestPassword123",
      isVerified: true,
      role: "seller",
    });

    await testSeller.save();
    console.log("✓ Created test seller account");

    // Create a mock file object (simulating multer file)
    const mockFile = {
      fieldname: "image",
      originalname: "test-image.jpg",
      encoding: "7bit",
      mimetype: "image/jpeg",
      buffer: Buffer.from("fake-image-data"), // This would be actual image data in real scenario
      size: 1024,
    };

    console.log("✓ Created mock file object");

    // Test Cloudinary upload
    console.log("Testing Cloudinary upload...");
    try {
      const cloudinaryResult = await uploadToCloudinary(
        mockFile,
        "coast2cart/items"
      );
      console.log("✓ Cloudinary upload successful");
      console.log("  - URL:", cloudinaryResult.secure_url);
      console.log("  - Public ID:", cloudinaryResult.public_id);

      // Create test item
      const testItem = new Item({
        seller: testSeller._id,
        itemType: "fish",
        itemName: "Test Bangus",
        itemPrice: 289.5,
        quantity: 10,
        unit: "kg",
        image: cloudinaryResult.secure_url,
        imagePublicId: cloudinaryResult.public_id,
        description: "Fresh test bangus from local fishermen",
        location: "Test Barangay, Test City",
      });

      await testItem.save();
      console.log("✓ Item created successfully");

      // Populate seller information
      await testItem.populate(
        "seller",
        "firstName lastName username email contactNo address"
      );
      console.log("✓ Seller information populated");

      // Display created item
      console.log("\n=== Created Item ===");
      console.log("ID:", testItem._id);
      console.log("Name:", testItem.itemName);
      console.log("Type:", testItem.itemType);
      console.log("Price:", testItem.formattedPrice);
      console.log("Quantity:", testItem.formattedQuantity);
      console.log("Image URL:", testItem.image);
      console.log("Public ID:", testItem.imagePublicId);
      console.log("Freshness:", testItem.isFresh);
      console.log(
        "Seller:",
        testItem.seller.firstName,
        testItem.seller.lastName
      );

      // Clean up test data
      await Item.deleteOne({ _id: testItem._id });
      await Account.deleteOne({ _id: testSeller._id });
      console.log("✓ Test data cleaned up");

      return true;
    } catch (uploadError) {
      console.log("✗ Cloudinary upload failed:", uploadError.message);
      return false;
    }
  } catch (error) {
    console.error("✗ Test failed:", error.message);
    return false;
  }
};

/**
 * Test item validation
 */
const testItemValidation = async () => {
  try {
    console.log("\n=== Testing Item Validation ===\n");

    // Test missing required fields
    const invalidItem = new Item({
      // Missing required fields
      itemName: "Test Item",
    });

    try {
      await invalidItem.save();
      console.log("✗ Validation should have failed");
      return false;
    } catch (validationError) {
      console.log("✓ Validation correctly caught missing fields");
      return true;
    }
  } catch (error) {
    console.error("✗ Validation test failed:", error.message);
    return false;
  }
};

/**
 * Test item retrieval
 */
const testItemRetrieval = async () => {
  try {
    console.log("\n=== Testing Item Retrieval ===\n");

    // Create test seller
    const testSeller = new Account({
      firstName: "Retrieval",
      lastName: "Test",
      username: "retrievaltest",
      dateOfBirth: new Date("1990-01-01"),
      contactNo: "9123456780",
      address: "Test Address",
      email: "retrieval@example.com",
      password: "TestPassword123",
      isVerified: true,
      role: "seller",
    });

    await testSeller.save();

    // Create test item
    const testItem = new Item({
      seller: testSeller._id,
      itemType: "souvenirs",
      itemName: "Test Keychain",
      itemPrice: 55,
      quantity: 20,
      unit: "pieces",
      image: "https://res.cloudinary.com/test/image/upload/test.jpg",
      imagePublicId: "test/public-id",
      description: "Test souvenir item",
    });

    await testItem.save();

    // Test retrieval
    const retrievedItem = await Item.findById(testItem._id).populate(
      "seller",
      "firstName lastName username email"
    );

    if (retrievedItem) {
      console.log("✓ Item retrieved successfully");
      console.log("  - Name:", retrievedItem.itemName);
      console.log(
        "  - Seller:",
        retrievedItem.seller.firstName,
        retrievedItem.seller.lastName
      );
      console.log("  - Formatted Price:", retrievedItem.formattedPrice);
      console.log("  - Formatted Quantity:", retrievedItem.formattedQuantity);
    } else {
      console.log("✗ Item retrieval failed");
      return false;
    }

    // Clean up
    await Item.deleteOne({ _id: testItem._id });
    await Account.deleteOne({ _id: testSeller._id });
    console.log("✓ Test data cleaned up");

    return true;
  } catch (error) {
    console.error("✗ Retrieval test failed:", error.message);
    return false;
  }
};

/**
 * Run all tests
 */
const runAllTests = async () => {
  try {
    console.log("Starting Item Creation Tests...\n");

    const creationTest = await testItemCreation();
    const validationTest = await testItemValidation();
    const retrievalTest = await testItemRetrieval();

    console.log("\n=== Test Results ===");
    console.log("Item Creation:", creationTest ? "✓ PASS" : "✗ FAIL");
    console.log("Item Validation:", validationTest ? "✓ PASS" : "✗ FAIL");
    console.log("Item Retrieval:", retrievalTest ? "✓ PASS" : "✗ FAIL");

    const allPassed = creationTest && validationTest && retrievalTest;
    console.log(
      "\nOverall Result:",
      allPassed ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED"
    );

    return allPassed;
  } catch (error) {
    console.error("Test suite failed:", error.message);
    return false;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("✓ Database connection closed");
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = {
  testItemCreation,
  testItemValidation,
  testItemRetrieval,
  runAllTests,
};
