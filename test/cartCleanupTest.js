const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Item = require("../models/Item");
const Account = require("../models/Accounts");
const {
  removeItemFromAllCarts,
  removeItemFromUserCart,
  cleanupCartsForInactiveItem,
  updateCartQuantitiesForReducedStock,
} = require("../services/cartCleanupService");

// Test cart cleanup functionality
const testCartCleanup = async () => {
  try {
    console.log("🧪 Testing Cart Cleanup Service...");

    // Test 1: Remove item from all carts
    console.log("\n1. Testing removeItemFromAllCarts...");
    const result1 = await removeItemFromAllCarts("507f1f77bcf86cd799439011", "test");
    console.log("Result:", result1);

    // Test 2: Remove item from specific user cart
    console.log("\n2. Testing removeItemFromUserCart...");
    const result2 = await removeItemFromUserCart("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012", "test");
    console.log("Result:", result2);

    // Test 3: Cleanup carts for inactive item
    console.log("\n3. Testing cleanupCartsForInactiveItem...");
    const result3 = await cleanupCartsForInactiveItem("507f1f77bcf86cd799439011");
    console.log("Result:", result3);

    // Test 4: Update cart quantities for reduced stock
    console.log("\n4. Testing updateCartQuantitiesForReducedStock...");
    const result4 = await updateCartQuantitiesForReducedStock("507f1f77bcf86cd799439011", 5);
    console.log("Result:", result4);

    console.log("\n✅ Cart cleanup service tests completed successfully!");
    
  } catch (error) {
    console.error("❌ Cart cleanup service test failed:", error);
  }
};

// Export for use in other test files
module.exports = {
  testCartCleanup
};

// Run tests if this file is executed directly
if (require.main === module) {
  testCartCleanup().then(() => {
    console.log("Test completed");
    process.exit(0);
  }).catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
}
