const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const Account = require("../models/Accounts");
const Transaction = require("../models/Transaction");
const Review = require("../models/Review");
const Item = require("../models/Item");

describe("Favorite Sellers API", () => {
  let buyerId, seller1Id, seller2Id, seller3Id;
  let item1Id, item2Id, item3Id;

  beforeAll(async () => {
    // Create test accounts
    const buyer = await Account.create({
      firstName: "John",
      lastName: "Buyer",
      username: "johnbuyer",
      dateOfBirth: new Date("1990-01-01"),
      contactNo: "9123456789",
      address: "Test Address",
      email: "john@test.com",
      password: "password123",
      role: "buyer",
      status: "validated"
    });
    buyerId = buyer._id;

    const seller1 = await Account.create({
      firstName: "Alice",
      lastName: "Seller",
      username: "aliceseller",
      dateOfBirth: new Date("1985-01-01"),
      contactNo: "9123456790",
      address: "Test Address",
      email: "alice@test.com",
      password: "password123",
      role: "seller",
      status: "validated"
    });
    seller1Id = seller1._id;

    const seller2 = await Account.create({
      firstName: "Bob",
      lastName: "Merchant",
      username: "bobmerchant",
      dateOfBirth: new Date("1988-01-01"),
      contactNo: "9123456791",
      address: "Test Address",
      email: "bob@test.com",
      password: "password123",
      role: "seller",
      status: "validated"
    });
    seller2Id = seller2._id;

    const seller3 = await Account.create({
      firstName: "Charlie",
      lastName: "Vendor",
      username: "charlievendor",
      dateOfBirth: new Date("1987-01-01"),
      contactNo: "9123456792",
      address: "Test Address",
      email: "charlie@test.com",
      password: "password123",
      role: "seller",
      status: "validated"
    });
    seller3Id = seller3._id;

    // Create test items
    const item1 = await Item.create({
      seller: seller1Id,
      itemType: "fish",
      itemName: "Fresh Tuna",
      itemPrice: 100,
      quantity: 10,
      unit: "kg",
      category: "fresh",
      description: "Fresh tuna fish",
      location: "Manila",
      isActive: true,
      image: "test-image-url",
      imagePublicId: "test-public-id"
    });
    item1Id = item1._id;

    const item2 = await Item.create({
      seller: seller2Id,
      itemType: "fish",
      itemName: "Salmon",
      itemPrice: 150,
      quantity: 5,
      unit: "kg",
      category: "fresh",
      description: "Fresh salmon",
      location: "Cebu",
      isActive: true,
      image: "test-image-url",
      imagePublicId: "test-public-id"
    });
    item2Id = item2._id;

    const item3 = await Item.create({
      seller: seller3Id,
      itemType: "souvenirs",
      itemName: "Shell Necklace",
      itemPrice: 50,
      quantity: 20,
      unit: "pieces",
      category: "jewelry",
      description: "Beautiful shell necklace",
      location: "Boracay",
      isActive: true,
      image: "test-image-url",
      imagePublicId: "test-public-id"
    });
    item3Id = item3._id;
  });

  beforeEach(async () => {
    // Clean up transactions and reviews before each test
    await Transaction.deleteMany({});
    await Review.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data
    await Account.deleteMany({});
    await Item.deleteMany({});
    await Transaction.deleteMany({});
    await Review.deleteMany({});
    await mongoose.connection.close();
  });

  describe("GET /api/items/favorite-sellers/:buyerId", () => {
    it("should return empty list when buyer has no purchase history", async () => {
      const response = await request(app)
        .get(`/api/items/favorite-sellers/${buyerId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.totalSellers).toBe(0);
    });

    it("should return favorite sellers with purchase counts and ratings", async () => {
      // Create transactions - buyer purchases from seller1 (3), seller2 (2), seller3 (1)
      await Transaction.create([
        {
          itemId: item1Id,
          sellerId: seller1Id,
          buyerId: buyerId,
          priceAtTransaction: 100,
          quantity: 2,
          unit: "kg",
          totalPrice: 200,
          status: "sold",
          markedSoldAt: new Date()
        },
        {
          itemId: item1Id,
          sellerId: seller1Id,
          buyerId: buyerId,
          priceAtTransaction: 100,
          quantity: 1,
          unit: "kg",
          totalPrice: 100,
          status: "sold",
          markedSoldAt: new Date()
        },
        {
          itemId: item1Id,
          sellerId: seller1Id,
          buyerId: buyerId,
          priceAtTransaction: 100,
          quantity: 1.5,
          unit: "kg",
          totalPrice: 150,
          status: "sold",
          markedSoldAt: new Date()
        },
        {
          itemId: item2Id,
          sellerId: seller2Id,
          buyerId: buyerId,
          priceAtTransaction: 150,
          quantity: 1,
          unit: "kg",
          totalPrice: 150,
          status: "sold",
          markedSoldAt: new Date()
        },
        {
          itemId: item2Id,
          sellerId: seller2Id,
          buyerId: buyerId,
          priceAtTransaction: 150,
          quantity: 2,
          unit: "kg",
          totalPrice: 300,
          status: "sold",
          markedSoldAt: new Date()
        },
        {
          itemId: item3Id,
          sellerId: seller3Id,
          buyerId: buyerId,
          priceAtTransaction: 50,
          quantity: 1,
          unit: "pieces",
          totalPrice: 50,
          status: "sold",
          markedSoldAt: new Date()
        }
      ]);

      // Create reviews for sellers
      await Review.create([
        { buyer: buyerId, seller: seller1Id, stars: 5, reviewText: "Great seller!" },
        { buyer: buyerId, seller: seller1Id, stars: 4, reviewText: "Good quality" },
        { buyer: buyerId, seller: seller2Id, stars: 3, reviewText: "Average" },
        { buyer: buyerId, seller: seller3Id, stars: 5, reviewText: "Excellent!" }
      ]);

      const response = await request(app)
        .get(`/api/items/favorite-sellers/${buyerId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination.totalSellers).toBe(3);

      // Check that sellers are sorted by purchase count (descending by default)
      expect(response.body.data[0].purchaseCount).toBe(3); // seller1
      expect(response.body.data[1].purchaseCount).toBe(2); // seller2
      expect(response.body.data[2].purchaseCount).toBe(1); // seller3

      // Check seller1 details
      const seller1Data = response.body.data[0];
      expect(seller1Data.sellerName).toBe("Alice Seller");
      expect(seller1Data.username).toBe("aliceseller");
      expect(seller1Data.purchaseCount).toBe(3);
      expect(seller1Data.totalSpent).toBe(450);
      expect(seller1Data.averageRating).toBe(4.5); // (5+4)/2
      expect(seller1Data.totalReviews).toBe(2);
    });

    it("should support search functionality", async () => {
      // Create transactions
      await Transaction.create([
        {
          itemId: item1Id,
          sellerId: seller1Id,
          buyerId: buyerId,
          priceAtTransaction: 100,
          quantity: 1,
          unit: "kg",
          totalPrice: 100,
          status: "sold",
          markedSoldAt: new Date()
        },
        {
          itemId: item2Id,
          sellerId: seller2Id,
          buyerId: buyerId,
          priceAtTransaction: 150,
          quantity: 1,
          unit: "kg",
          totalPrice: 150,
          status: "sold",
          markedSoldAt: new Date()
        }
      ]);

      // Search for "Alice"
      const response = await request(app)
        .get(`/api/items/favorite-sellers/${buyerId}?search=Alice`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].sellerName).toBe("Alice Seller");
      expect(response.body.search).toBe("Alice");
    });

    it("should support sorting by different fields", async () => {
      // Create sold items with different ratings
      await SoldItem.create([
        {
          item: item1Id,
          seller: seller1Id,
          buyer: buyerId,
          itemType: "fish",
          itemName: "Fresh Tuna",
          itemPrice: 100,
          quantitySold: 1,
          unit: "kg",
          totalAmount: 100,
          image: "test-image-url",
          imagePublicId: "test-public-id"
        },
        {
          item: item2Id,
          seller: seller2Id,
          buyer: buyerId,
          itemType: "fish",
          itemName: "Salmon",
          itemPrice: 150,
          quantitySold: 1,
          unit: "kg",
          totalAmount: 150,
          image: "test-image-url",
          imagePublicId: "test-public-id"
        }
      ]);

      // Create reviews with different ratings
      await Review.create([
        { buyer: buyerId, seller: seller1Id, stars: 3, reviewText: "Average" },
        { buyer: buyerId, seller: seller2Id, stars: 5, reviewText: "Excellent!" }
      ]);

      // Sort by average rating descending
      const response = await request(app)
        .get(`/api/items/favorite-sellers/${buyerId}?sortBy=averageRating&sortOrder=desc`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].averageRating).toBe(5); // seller2
      expect(response.body.data[1].averageRating).toBe(3); // seller1
      expect(response.body.sortBy).toBe("averageRating");
      expect(response.body.sortOrder).toBe("desc");
    });

    it("should support pagination", async () => {
      // Create sold items for multiple sellers
      const sellers = [];
      for (let i = 0; i < 5; i++) {
        const seller = await Account.create({
          firstName: `Seller${i}`,
          lastName: `Last${i}`,
          username: `seller${i}`,
          dateOfBirth: new Date("1985-01-01"),
          contactNo: `91234567${90 + i}`,
          address: "Test Address",
          email: `seller${i}@test.com`,
          password: "password123",
          role: "seller",
          status: "validated"
        });
        sellers.push(seller);

        const item = await Item.create({
          seller: seller._id,
          itemType: "fish",
          itemName: `Fish ${i}`,
          itemPrice: 100,
          quantity: 10,
          unit: "kg",
          category: "fresh",
          description: "Test fish",
          location: "Test Location",
          isActive: true,
          image: "test-image-url",
          imagePublicId: "test-public-id"
        });

        await Transaction.create({
          itemId: item._id,
          sellerId: seller._id,
          buyerId: buyerId,
          priceAtTransaction: 100,
          quantity: 1,
          unit: "kg",
          totalPrice: 100,
          status: "sold",
          markedSoldAt: new Date()
        });
      }

      // Test pagination
      const response = await request(app)
        .get(`/api/items/favorite-sellers/${buyerId}?page=1&limit=2`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.totalPages).toBe(3); // 5 sellers, 2 per page
      expect(response.body.pagination.totalSellers).toBe(5);
      expect(response.body.pagination.sellersPerPage).toBe(2);
    });

    it("should return 400 for invalid buyer ID", async () => {
      const response = await request(app)
        .get("/api/items/favorite-sellers/invalid-id")
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should return 404 for non-existent buyer", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/items/favorite-sellers/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it("should return 400 for invalid pagination parameters", async () => {
      const response = await request(app)
        .get(`/api/items/favorite-sellers/${buyerId}?page=0&limit=101`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should return 400 for invalid sort parameters", async () => {
      const response = await request(app)
        .get(`/api/items/favorite-sellers/${buyerId}?sortBy=invalidField&sortOrder=invalid`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
