const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../server");
const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");
const Item = require("../models/Item");
const Accounts = require("../models/Accounts");

describe("Mark Item as Sold Functionality", () => {
  let seller, buyer, item, chatRoom, sellerToken, buyerToken;

  beforeAll(async () => {
    // Create test seller account with validated status
    seller = new Accounts({
      username: "test_seller",
      email: "seller@test.com",
      password: "password123",
      role: "seller",
      isVerified: true,
      sellerStatus: "validated", // Fully validated seller
      sellerApprovalStatus: "approved",
    });
    await seller.save();

    // Create test buyer account
    buyer = new Accounts({
      username: "test_buyer",
      email: "buyer@test.com",
      password: "password123",
      role: "buyer",
      isVerified: true,
    });
    await buyer.save();

    // Create test item
    item = new Item({
      seller: seller._id,
      itemType: "fish",
      category: "Fresh Fish",
      itemName: "Fresh Tuna",
      itemPrice: 150.00,
      quantity: 10,
      unit: "kg",
      image: "https://example.com/tuna.jpg",
      imagePublicId: "tuna_public_id",
      description: "Fresh caught tuna",
      location: "Cebu",
    });
    await item.save();

    // Create chat room
    chatRoom = new ChatRoom({
      participants: [seller._id, buyer._id],
      itemId: item._id,
      unreadCount: new Map([
        [seller._id.toString(), 0],
        [buyer._id.toString(), 0],
      ]),
    });
    await chatRoom.save();

    // Generate auth tokens (simplified for testing)
    sellerToken = "mock_seller_token";
    buyerToken = "mock_buyer_token";
  });

  afterAll(async () => {
    // Clean up test data
    await Accounts.deleteMany({ email: { $in: ["seller@test.com", "buyer@test.com"] } });
    await Item.deleteMany({ itemName: "Fresh Tuna" });
    await ChatRoom.deleteMany({});
    await Message.deleteMany({});
  });

  describe("POST /api/chat/rooms/:chatRoomId/mark-sold", () => {
    it("should successfully mark item as sold by seller", async () => {
      const initialQuantity = item.quantity;

      const response = await request(app)
        .post(`/api/chat/rooms/${chatRoom._id}/mark-sold`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Item marked as sold successfully");
      expect(response.body.data.soldQuantity).toBe(initialQuantity);
      expect(response.body.data.remainingQuantity).toBe(0);
      expect(response.body.data.totalPrice).toBe(item.itemPrice * initialQuantity);
      expect(response.body.data.updatedItem.isSoldOut).toBe(true);

      // Verify item quantity was set to 0
      const updatedItem = await Item.findById(item._id);
      expect(updatedItem.quantity).toBe(0);

      // Verify sold message was created
      const soldMessage = await Message.findOne({
        chatRoomId: chatRoom._id,
        messageType: "text",
        "content.text": { $regex: "Item marked as sold" },
      });
      expect(soldMessage).toBeTruthy();
      expect(soldMessage.content.text).toContain(`${initialQuantity} kg`);
      expect(soldMessage.content.text).toContain("sold out");
    });

    it("should reject marking item as sold by buyer", async () => {
      const response = await request(app)
        .post(`/api/chat/rooms/${chatRoom._id}/mark-sold`)
        .set("Authorization", `Bearer ${buyerToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Insufficient permissions");
    });

    it("should reject marking already sold out item", async () => {
      // First mark the item as sold
      await request(app)
        .post(`/api/chat/rooms/${chatRoom._id}/mark-sold`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .expect(200);

      // Try to mark it as sold again
      const response = await request(app)
        .post(`/api/chat/rooms/${chatRoom._id}/mark-sold`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Item is already sold out");
    });

    it("should reject marking sold for chat room without item", async () => {
      // Create chat room without item
      const chatRoomWithoutItem = new ChatRoom({
        participants: [seller._id, buyer._id],
        unreadCount: new Map([
          [seller._id.toString(), 0],
          [buyer._id.toString(), 0],
        ]),
      });
      await chatRoomWithoutItem.save();

      const response = await request(app)
        .post(`/api/chat/rooms/${chatRoomWithoutItem._id}/mark-sold`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not associated with any item");

      // Clean up
      await ChatRoom.findByIdAndDelete(chatRoomWithoutItem._id);
    });
  });

  describe("Authorization Tests", () => {
    it("should reject marking item as sold by non-validated seller", async () => {
      // Create a seller with pending status
      const pendingSeller = new Accounts({
        username: "pending_seller",
        email: "pending@test.com",
        password: "password123",
        role: "seller",
        isVerified: true,
        sellerStatus: "pending_admin", // Not fully validated
        sellerApprovalStatus: "pending",
      });
      await pendingSeller.save();

      // Create item for pending seller
      const pendingItem = new Item({
        seller: pendingSeller._id,
        itemType: "fish",
        category: "Fresh Fish",
        itemName: "Pending Fish",
        itemPrice: 100.00,
        quantity: 5,
        unit: "kg",
        image: "https://example.com/pending.jpg",
        imagePublicId: "pending_public_id",
        description: "Pending seller fish",
        location: "Cebu",
      });
      await pendingItem.save();

      // Create chat room for pending seller
      const pendingChatRoom = new ChatRoom({
        participants: [pendingSeller._id, buyer._id],
        itemId: pendingItem._id,
        unreadCount: new Map([
          [pendingSeller._id.toString(), 0],
          [buyer._id.toString(), 0],
        ]),
      });
      await pendingChatRoom.save();

      const response = await request(app)
        .post(`/api/chat/rooms/${pendingChatRoom._id}/mark-sold`)
        .set("Authorization", `Bearer mock_pending_seller_token`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Seller account must be fully validated");

      // Clean up
      await Accounts.findByIdAndDelete(pendingSeller._id);
      await Item.findByIdAndDelete(pendingItem._id);
      await ChatRoom.findByIdAndDelete(pendingChatRoom._id);
    });
  });

  describe("Edge Cases", () => {
    it("should handle selling all remaining quantity", async () => {
      const remainingQuantity = item.quantity;
      
      const response = await request(app)
        .post(`/api/chat/rooms/${chatRoom._id}/mark-sold`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.data.soldQuantity).toBe(remainingQuantity);
      expect(response.body.data.remainingQuantity).toBe(0);
      expect(response.body.data.updatedItem.isSoldOut).toBe(true);

      // Verify item quantity is now 0
      const updatedItem = await Item.findById(item._id);
      expect(updatedItem.quantity).toBe(0);
    });

    it("should handle single unit items", async () => {
      // Reset item quantity for this test
      await Item.findByIdAndUpdate(item._id, { quantity: 1 });

      const response = await request(app)
        .post(`/api/chat/rooms/${chatRoom._id}/mark-sold`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.data.soldQuantity).toBe(1);
      expect(response.body.data.remainingQuantity).toBe(0);
    });
  });
});

module.exports = {
  describe,
  beforeAll,
  afterAll,
  it,
  expect,
};
