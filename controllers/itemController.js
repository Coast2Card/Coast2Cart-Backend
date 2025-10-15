const mongoose = require("mongoose");
const Item = require("../models/Item");
const Transaction = require("../models/Transaction");
const Account = require("../models/Accounts");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");
const { StatusCodes } = require("http-status-codes");
const {
  uploadImage,
  deleteImage,
} = require("../services/imageUploadService");
const {
  removeItemFromUserCart,
  updateCartQuantitiesForReducedStock,
  cleanupCartsForInactiveItem,
} = require("../services/cartCleanupService");

// Helper to shape item responses: limit seller fields and remove sensitive/unused fields
const sanitizeItem = (item) => {
  const raw = item && typeof item.toObject === "function" ? item.toObject({ virtuals: true }) : item;
  if (!raw) return raw;
  // Strip fields
  delete raw.itemPrice;
  delete raw.unit;
  delete raw.imagePublicId;
  delete raw.__v;
  // Minimize seller
  if (raw.seller && typeof raw.seller === "object") {
    raw.seller = { _id: raw.seller._id, username: raw.seller.username };
  }
  return raw;
};

/**
 * Create a new item listing
 */
const createItem = async (req, res, next) => {
  try {
    const {
      itemType,
      itemName,
      itemPrice,
      quantity,
      unit,
      category,
      description,
      location,
    } = req.body;

    // Validate required fields
    if (!itemType || !itemName || !itemPrice || !quantity || !unit || !location) {
      return next(
        new BadRequestError(
          "Missing required fields: itemType, itemName, itemPrice, quantity, unit, location"
        )
      );
    }

    // Image presence/type/size validated by validateMulterImage middleware

    let cloudinaryResult = null;
    try {
      // Upload image to Cloudinary via service
      cloudinaryResult = await uploadImage(req.file, {
        folder: "coast2cart/items",
      });
    } catch (uploadError) {
      console.error("Cloudinary upload failed:", uploadError);
      return next(
        new BadRequestError("Failed to upload image. Please try again.")
      );
    }

    // Validate parsed numbers
    const parsedPrice = parseFloat(itemPrice);
    const parsedQuantity = parseFloat(quantity);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return next(new BadRequestError("Item price must be a positive number"));
    }

    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return next(
        new BadRequestError("Quantity must be a non-negative number")
      );
    }

    // Create new item
    const item = new Item({
      seller: req.user.id,
      itemType,
      itemName,
      itemPrice: parsedPrice,
      quantity: parsedQuantity,
      unit,
      // Only saved when provided; schema enforces requirement when itemType is 'fish'
      category,
      image: cloudinaryResult.url, // Cloudinary URL from service
      imagePublicId: cloudinaryResult.publicId, // Store public ID for future operations
      description,
      location,
    });

    try {
      await item.save();
    } catch (saveError) {
      // If item save fails, clean up uploaded image
      if (cloudinaryResult && cloudinaryResult.publicId) {
        try {
          await deleteImage(cloudinaryResult.publicId);
        } catch (deleteError) {
          console.error("Failed to clean up uploaded image:", deleteError);
        }
      }
      throw saveError;
    }

    // Populate minimal seller information
    await item.populate("seller", "username");

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Item created successfully",
      data: sanitizeItem(item),
    });
  } catch (error) {
    console.error("Item creation error:", error);
    next(error);
  }
};

/**
 * Get all active items with optional filtering
 */
const getAllItems = async (req, res, next) => {
  try {
    const {
      itemType,
      seller,
      search,
      category,
      priceRange,
      sortBy = "catchDate",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    // Build filter using $and with optional $or subclauses to support multi-selects
    const andConditions = [{ isActive: true }];

    // itemType normalization
    if (itemType) {
      const normalizedType = String(itemType).toLowerCase();
      if (normalizedType === "seafood") {
        andConditions.push({ itemType: "fish" });
      } else if (normalizedType === "souvenir") {
        andConditions.push({ itemType: "souvenirs" });
      } else {
        andConditions.push({ itemType: normalizedType });
      }
    }

    if (seller) {
      andConditions.push({ seller });
    }

    // Normalize category to array (accept array or comma-separated string)
    let categoryArray = [];
    if (Array.isArray(category)) {
      categoryArray = category.flatMap((c) => String(c).split(",")).map((c) => c.trim()).filter(Boolean);
    } else if (typeof category === "string") {
      categoryArray = String(category).split(",").map((c) => c.trim()).filter(Boolean);
    }

    const isAllCategory = categoryArray.length > 0 && categoryArray.some((c) => c.toLowerCase() === "all");

    if (categoryArray.length > 0 && !isAllCategory) {
      andConditions.push({ category: { $in: categoryArray } });
    }

    // Handle price range filtering (accept multiple)
    let priceRanges = [];
    if (Array.isArray(priceRange)) {
      priceRanges = priceRange.flatMap((p) => String(p).split(",")).map((p) => p.trim()).filter(Boolean);
    } else if (typeof priceRange === "string") {
      priceRanges = String(priceRange).split(",").map((p) => p.trim()).filter(Boolean);
    }

    const priceOrConditions = [];
    for (const pr of priceRanges) {
      switch (pr) {
        case "100-199":
          priceOrConditions.push({ itemPrice: { $gte: 100, $lt: 200 } });
          break;
        case "200-399":
          priceOrConditions.push({ itemPrice: { $gte: 200, $lt: 400 } });
          break;
        case "400-699":
          priceOrConditions.push({ itemPrice: { $gte: 400, $lt: 700 } });
          break;
        case "700+":
          priceOrConditions.push({ itemPrice: { $gte: 700 } });
          break;
        case "all":
          // ignore, equivalent to no price filter
          break;
        default:
          return next(new BadRequestError("Invalid price range. Use: 100-199, 200-399, 400-699, 700+, or comma-separated list"));
      }
    }
    if (priceOrConditions.length > 0) {
      andConditions.push({ $or: priceOrConditions });
    }

    // Search across name and description
    if (search) {
      andConditions.push({
        $or: [
          { itemName: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      });
    }

    // Final filter: collapse to single object when possible
    const filter = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const items = await Item.find(filter)
      .populate("seller", "username")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalItems = await Item.countDocuments(filter);

    // Prepare response data
    const responseData = {
      success: true,
      data: items.map(sanitizeItem),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        totalItems,
        itemsPerPage: parseInt(limit),
      },
    };

    // If a specific category (or categories) is requested and not 'all', include total for that filter
    if (categoryArray.length > 0 && !isAllCategory) {
      responseData.categoryTotalItems = totalItems;
    }

    // Add category counts for seafood items when no specific category is requested
    if (itemType === "seafood" && (categoryArray.length === 0 || isAllCategory)) {
      const categoryCounts = await Item.aggregate([
        {
          $match: {
            isActive: true,
            itemType: "fish",
            category: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      // Format category counts
      const formattedCounts = categoryCounts.map(item => ({
        category: item._id,
        count: item.count
      }));

      responseData.categoryCounts = formattedCounts;
    }

    res.status(StatusCodes.OK).json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * Get items by seller (for seller's own listings)
 */
const getItemsBySeller = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const { isActive, itemType, page = 1, limit = 20 } = req.query;

    // Build filter object
    const filter = { seller: sellerId };

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (itemType) {
      filter.itemType = itemType;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const items = await Item.find(filter)
      .populate("seller", "username")
      .sort({ catchDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalItems = await Item.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      data: items.map(sanitizeItem),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        totalItems,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single item by ID
 */
const getItemById = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const item = await Item.findById(itemId).populate("seller", "username");

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: sanitizeItem(item),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update item (only by owner)
 */
const updateItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const updateData = { ...req.body };

    // Disallow status changes via general update endpoint
    if (Object.prototype.hasOwnProperty.call(updateData, "isActive")) {
      delete updateData.isActive;
    }

    // Find the item
    const item = await Item.findById(itemId);

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Check if user is the owner
    if (item.seller.toString() !== req.user.id.toString().toString()) {
      return next(new UnauthorizedError("You can only update your own items"));
    }

    // Handle image update if new image is uploaded
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (item.imagePublicId) {
        try {
          await deleteImage(item.imagePublicId);
        } catch (error) {
          console.error("Error deleting old image:", error);
          // Continue with update even if deletion fails
        }
      }

      // Upload new image to Cloudinary
      const uploadResult = await uploadImage(req.file, {
        folder: "coast2cart/items",
      });
      updateData.image = uploadResult.url;
      updateData.imagePublicId = uploadResult.publicId;
    }

    // Convert string numbers to actual numbers
    if (updateData.itemPrice) {
      updateData.itemPrice = parseFloat(updateData.itemPrice);
    }
    if (updateData.quantity) {
      updateData.quantity = parseFloat(updateData.quantity);
    }

    // Update the item
    const updatedItem = await Item.findByIdAndUpdate(itemId, updateData, {
      new: true,
      runValidators: true,
    }).populate("seller", "username");

    // Clean up carts if quantity becomes 0
    if (updateData.quantity !== undefined && updatedItem.quantity <= 0) {
      try {
        // If quantity becomes 0, mark as inactive and remove from all carts
        await Item.findByIdAndUpdate(itemId, { isActive: false });
        await cleanupCartsForInactiveItem(itemId);
      } catch (cartCleanupError) {
        console.error('Cart cleanup error during item update:', cartCleanupError);
        // Don't fail the update if cart cleanup fails
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Item updated successfully",
      data: sanitizeItem(updatedItem),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete item (only by owner)
 */
const deleteItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const item = await Item.findById(itemId);

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Check if user is the owner
    if (item.seller.toString() !== req.user.id.toString()) {
      return next(new UnauthorizedError("You can only delete your own items"));
    }

    // Clean up carts before deleting item
    try {
      await cleanupCartsForInactiveItem(itemId);
    } catch (cartCleanupError) {
      console.error('Cart cleanup error during item deletion:', cartCleanupError);
      // Continue with deletion even if cart cleanup fails
    }

    // Delete image from Cloudinary if it exists
    if (item.imagePublicId) {
      try {
        await deleteImage(item.imagePublicId);
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
        // Continue with deletion even if image deletion fails
      }
    }

    // Hard delete item document
    await Item.findByIdAndDelete(itemId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Item permanently deleted",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set item active status (only by owner)
 */
const setItemActiveStatus = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return next(new BadRequestError("isActive must be a boolean"));
    }

    const item = await Item.findById(itemId);

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    if (item.seller.toString() !== req.user.id.toString()) {
      return next(new UnauthorizedError("You can only update your own items"));
    }

    item.isActive = isActive;
    await item.save();

    // Clean up carts if item becomes inactive
    if (!isActive) {
      try {
        await cleanupCartsForInactiveItem(itemId);
      } catch (cartCleanupError) {
        console.error('Cart cleanup error during item status change:', cartCleanupError);
        // Don't fail the status update if cart cleanup fails
      }
    }

    const populated = await item.populate("seller", "username");

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Item status updated",
      data: sanitizeItem(populated),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Hard delete item (only by owner)
 */
const deleteItemHard = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const item = await Item.findById(itemId);

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Check if user is the owner
    if (item.seller.toString() !== req.user.id.toString()) {
      return next(new UnauthorizedError("You can only delete your own items"));
    }

    // Clean up carts before deleting item
    try {
      await cleanupCartsForInactiveItem(itemId);
    } catch (cartCleanupError) {
      console.error('Cart cleanup error during item hard deletion:', cartCleanupError);
      // Continue with deletion even if cart cleanup fails
    }

    // Delete image from Cloudinary if it exists
    if (item.imagePublicId) {
      try {
        await deleteImage(item.imagePublicId);
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
        // Continue with deletion even if image deletion fails
      }
    }

    await Item.findByIdAndDelete(itemId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Item permanently deleted",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sell an item (mark as sold and create transaction record)
 */
const sellItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantitySold, buyerId, notes } = req.body;

    // Find the item
    const item = await Item.findById(itemId);

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Check if user is the owner
    if (item.seller.toString() !== req.user.id.toString()) {
      return next(new UnauthorizedError("You can only sell your own items"));
    }

    // Check if item is active
    if (!item.isActive) {
      return next(new BadRequestError("Cannot sell inactive item"));
    }

    // Check if sufficient quantity is available
    if (parseFloat(quantitySold) > item.quantity) {
      return next(new BadRequestError("Insufficient quantity available"));
    }

    // Verify buyer exists
    const buyer = await Account.findById(buyerId);
    if (!buyer) {
      return next(new NotFoundError("Buyer not found"));
    }

    // Calculate total amount
    const totalAmount = item.itemPrice * parseFloat(quantitySold);

    // Create transaction record (sold)
    const transaction = new Transaction({
      chatRoomId: undefined, // optional when selling directly
      itemId: item._id,
      buyerId: buyerId,
      sellerId: item.seller,
      quantity: parseFloat(quantitySold),
      unit: item.unit,
      priceAtTransaction: item.itemPrice,
      totalPrice: totalAmount,
      status: "sold",
      markedSoldAt: new Date(),
      markedSoldBy: req.user.id,
    });

    await transaction.save();

    // Update item quantity
    item.quantity -= parseFloat(quantitySold);

    // If quantity becomes 0, mark as inactive
    if (item.quantity <= 0) {
      item.isActive = false;
    }

    await item.save();

    // Clean up carts after sale
    try {
      // Remove the sold item from the buyer's cart
      await removeItemFromUserCart(itemId, buyerId, 'sold');
      
      // Only remove from all carts if item is completely sold out
      if (item.quantity <= 0) {
        await cleanupCartsForInactiveItem(itemId);
      }
    } catch (cartCleanupError) {
      console.error('Cart cleanup error during item sale:', cartCleanupError);
      // Don't fail the sale if cart cleanup fails
    }

    // Populate the transaction with buyer and seller info
    await transaction.populate([
      {
        path: "sellerId",
        select: "firstName lastName username email contactNo address",
      },
      {
        path: "buyerId",
        select: "firstName lastName username email contactNo address",
      },
      {
        path: "itemId",
        select: "itemName image unit",
      },
    ]);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Item sold successfully",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sold transactions by seller
 */
const getSoldItemsBySeller = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const { itemType, page = 1, limit = 20 } = req.query;

    // Build filter object
    const filter = { sellerId: sellerId, status: "sold" };

    if (itemType) {
      // Filter by item type via item lookup
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const transactions = await Transaction.find(filter)
      .populate("buyerId", "firstName lastName username email contactNo address")
      .populate("itemId", "itemName itemPrice image unit itemType")
      .sort({ markedSoldAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalItems = await Transaction.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      data: transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        totalItems,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sold transactions by buyer with search and sorting functionality
 */
const getSoldItemsByBuyer = async (req, res, next) => {
  try {
    const { buyerId } = req.params;
    const { 
      itemType, 
      search, 
      page = 1, 
      limit = 20,
      sortBy = "markedSoldAt",
      sortOrder = "desc"
    } = req.query;

    // Build filter object
    const filter = { buyerId: buyerId, status: "sold" };

    // itemType filter will be applied via lookup and match if provided

    // Add search functionality for item name and seller name
    if (search) {
      // Use aggregation to search across item name and seller name
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "items",
            localField: "itemId",
            foreignField: "_id",
            as: "itemInfo"
          }
        },
        { $unwind: "$itemInfo" },
        ...(itemType ? [{ $match: { "itemInfo.itemType": itemType } }] : []),
        {
          $lookup: {
            from: "accounts",
            localField: "sellerId",
            foreignField: "_id",
            as: "sellerInfo"
          }
        },
        {
          $unwind: "$sellerInfo"
        },
        {
          $match: {
            $or: [
              { "itemInfo.itemName": { $regex: search, $options: "i" } },
              { "sellerInfo.username": { $regex: search, $options: "i" } },
              { "sellerInfo.firstName": { $regex: search, $options: "i" } },
              { "sellerInfo.lastName": { $regex: search, $options: "i" } }
            ]
          }
        },
        {
          $project: {
            seller: {
              firstName: "$sellerInfo.firstName",
              lastName: "$sellerInfo.lastName",
              username: "$sellerInfo.username",
              email: "$sellerInfo.email",
              contactNo: "$sellerInfo.contactNo",
              address: "$sellerInfo.address"
            },
            item: "$itemId",
            itemType: "$itemInfo.itemType",
            itemName: "$itemInfo.itemName",
            itemPrice: "$priceAtTransaction",
            quantitySold: "$quantity",
            unit: 1,
            totalAmount: "$totalPrice",
            image: "$itemInfo.image",
            imagePublicId: "$itemInfo.imagePublicId",
            saleDate: "$markedSoldAt",
            createdAt: 1,
            updatedAt: 1
          }
        },
        {
          $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 }
        },
        {
          $skip: (parseInt(page) - 1) * parseInt(limit)
        },
        {
          $limit: parseInt(limit)
        }
      ];

      // Get total count for search results
      const countPipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "accounts",
            localField: "seller",
            foreignField: "_id",
            as: "sellerInfo"
          }
        },
        {
          $unwind: "$sellerInfo"
        },
        {
          $match: {
            $or: [
              { itemName: { $regex: search, $options: "i" } },
              { "sellerInfo.username": { $regex: search, $options: "i" } },
              { "sellerInfo.firstName": { $regex: search, $options: "i" } },
              { "sellerInfo.lastName": { $regex: search, $options: "i" } }
            ]
          }
        },
        {
          $count: "total"
        }
      ];

      const [soldItems, countResult] = await Promise.all([
        Transaction.aggregate(pipeline),
        Transaction.aggregate(countPipeline)
      ]);

      const totalItems = countResult.length > 0 ? countResult[0].total : 0;

      res.status(StatusCodes.OK).json({
        success: true,
        data: soldItems,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalItems / parseInt(limit)),
          totalItems,
          itemsPerPage: parseInt(limit),
        },
      });
    } else {
      // No search - use regular query for better performance
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      // Execute query
      const soldItems = await Transaction.find(filter)
        .populate("sellerId", "firstName lastName username email contactNo address")
        .populate("itemId", "itemName itemPrice image unit itemType")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count
      const totalItems = await Transaction.countDocuments(filter);

      res.status(StatusCodes.OK).json({
        success: true,
        data: soldItems,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalItems / parseInt(limit)),
          totalItems,
          itemsPerPage: parseInt(limit),
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get favorite sellers for a buyer based on purchase history (using Transactions)
 */
const getFavoriteSellers = async (req, res, next) => {
  try {
    const { buyerId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      search = "", 
      sortBy = "purchaseCount", 
      sortOrder = "desc" 
    } = req.query;

    // Validate buyerId
    if (!buyerId) {
      return next(new BadRequestError("Buyer ID is required"));
    }

    // Validate buyer exists
    const buyer = await Account.findById(buyerId);
    if (!buyer) {
      return next(new NotFoundError("Buyer not found"));
    }

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return next(new BadRequestError("Invalid pagination parameters"));
    }

    // Validate sort parameters
    const allowedSortFields = ["purchaseCount", "averageRating", "sellerName"];
    if (!allowedSortFields.includes(sortBy)) {
      return next(new BadRequestError("Invalid sort field"));
    }

    const allowedSortOrders = ["asc", "desc"];
    if (!allowedSortOrders.includes(sortOrder)) {
      return next(new BadRequestError("Invalid sort order"));
    }

    // Build aggregation pipeline (only sold transactions)
    const pipeline = [
      // Match sold transactions for this buyer
      {
        $match: {
          buyerId: new mongoose.Types.ObjectId(buyerId),
          status: "sold"
        }
      },
      // Group by seller to count purchases
      {
        $group: {
          _id: "$sellerId",
          purchaseCount: { $sum: 1 },
          totalSpent: { $sum: "$totalPrice" },
          lastPurchaseDate: { $max: "$markedSoldAt" }
        }
      },
      // Lookup seller details
      {
        $lookup: {
          from: "accounts",
          localField: "_id",
          foreignField: "_id",
          as: "seller"
        }
      },
      // Unwind seller array
      {
        $unwind: "$seller"
      },
      // Filter out sellers that don't match search criteria
      ...(search ? [{
        $match: {
          $or: [
            { "seller.firstName": { $regex: search, $options: "i" } },
            { "seller.lastName": { $regex: search, $options: "i" } },
            { "seller.username": { $regex: search, $options: "i" } }
          ]
        }
      }] : []),
      // Lookup reviews for average rating calculation
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "seller",
          as: "reviews"
        }
      },
      // Calculate average rating
      {
        $addFields: {
          averageRating: {
            $cond: {
              if: { $gt: [{ $size: "$reviews" }, 0] },
              then: { $avg: "$reviews.stars" },
              else: 0
            }
          },
          totalReviews: { $size: "$reviews" },
          sellerName: {
            $concat: ["$seller.firstName", " ", "$seller.lastName"]
          }
        }
      },
      // Project final fields
      {
        $project: {
          _id: 1,
          sellerId: "$_id",
          sellerName: 1,
          username: "$seller.username",
          profilePicture: "$seller.profilePicture",
          purchaseCount: 1,
          totalSpent: 1,
          averageRating: { $round: ["$averageRating", 2] },
          totalReviews: 1,
          lastPurchaseDate: 1
        }
      }
    ];

    // Add sorting
    const sortField = sortBy === "sellerName" ? "sellerName" : sortBy;
    pipeline.push({
      $sort: {
        [sortField]: sortOrder === "desc" ? -1 : 1
      }
    });

    // Execute aggregation to get total count
    const countPipeline = [...pipeline, { $count: "total" }];
    const [favoriteSellers, countResult] = await Promise.all([
      Transaction.aggregate([
        ...pipeline,
        { $skip: (pageNum - 1) * limitNum },
        { $limit: limitNum }
      ]),
      Transaction.aggregate(countPipeline)
    ]);

    const totalSellers = countResult.length > 0 ? countResult[0].total : 0;

    res.status(StatusCodes.OK).json({
      success: true,
      data: favoriteSellers,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalSellers / limitNum),
        totalSellers,
        sellersPerPage: limitNum,
      },
      search: search || null,
      sortBy,
      sortOrder
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createItem,
  getAllItems,
  getItemsBySeller,
  getItemById,
  updateItem,
  deleteItem,
  setItemActiveStatus,
  sellItem,
  getSoldItemsBySeller,
  getSoldItemsByBuyer,
  getFavoriteSellers,
};
