const Item = require("../models/Item");
const SoldItem = require("../models/SoldItem");
const Account = require("../models/Accounts");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");
const { StatusCodes } = require("http-status-codes");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
  getOptimizedImageUrl,
} = require("../middleware/cloudinaryUpload");

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
      description,
      location,
    } = req.body;

    // Validate required fields
    if (!itemType || !itemName || !itemPrice || !quantity || !unit) {
      return next(
        new BadRequestError(
          "Missing required fields: itemType, itemName, itemPrice, quantity, unit"
        )
      );
    }

    // Check if image was uploaded
    if (!req.file) {
      return next(new BadRequestError("Item image is required"));
    }

    // Validate image file
    if (!req.file.mimetype.startsWith("image/")) {
      return next(new BadRequestError("Only image files are allowed"));
    }

    // Validate file size (10MB limit)
    if (req.file.size > 10 * 1024 * 1024) {
      return next(
        new BadRequestError("Image file size must be less than 10MB")
      );
    }

    let cloudinaryResult = null;
    try {
      // Upload image to Cloudinary
      cloudinaryResult = await uploadToCloudinary(req.file, "coast2cart/items");
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
      image: cloudinaryResult.secure_url, // Cloudinary URL
      imagePublicId: cloudinaryResult.public_id, // Store public ID for future operations
      description,
      location,
    });

    try {
      await item.save();
    } catch (saveError) {
      // If item save fails, clean up uploaded image
      if (cloudinaryResult && cloudinaryResult.public_id) {
        try {
          await deleteFromCloudinary(cloudinaryResult.public_id);
        } catch (deleteError) {
          console.error("Failed to clean up uploaded image:", deleteError);
        }
      }
      throw saveError;
    }

    // Populate seller information
    await item.populate(
      "seller",
      "firstName lastName username email contactNo address"
    );

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Item created successfully",
      data: item,
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
      sortBy = "catchDate",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (itemType) {
      filter.itemType = itemType;
    }

    if (seller) {
      filter.seller = seller;
    }

    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const items = await Item.find(filter)
      .populate("seller", "firstName lastName username email contactNo address")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalItems = await Item.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      data: items,
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
      .populate("seller", "firstName lastName username email contactNo address")
      .sort({ catchDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalItems = await Item.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      data: items,
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

    const item = await Item.findById(itemId).populate(
      "seller",
      "firstName lastName username email contactNo address"
    );

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: item,
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

    // Find the item
    const item = await Item.findById(itemId);

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Check if user is the owner
    if (item.seller.toString() !== req.user.id) {
      return next(new UnauthorizedError("You can only update your own items"));
    }

    // Handle image update if new image is uploaded
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (item.imagePublicId) {
        try {
          await deleteFromCloudinary(item.imagePublicId);
        } catch (error) {
          console.error("Error deleting old image:", error);
          // Continue with update even if deletion fails
        }
      }

      // Upload new image to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(
        req.file,
        "coast2cart/items"
      );
      updateData.image = cloudinaryResult.secure_url;
      updateData.imagePublicId = cloudinaryResult.public_id;
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
    }).populate(
      "seller",
      "firstName lastName username email contactNo address"
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Item updated successfully",
      data: updatedItem,
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
    if (item.seller.toString() !== req.user.id) {
      return next(new UnauthorizedError("You can only delete your own items"));
    }

    // Delete image from Cloudinary if it exists
    if (item.imagePublicId) {
      try {
        await deleteFromCloudinary(item.imagePublicId);
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
        // Continue with deletion even if image deletion fails
      }
    }

    // Soft delete by setting isActive to false
    item.isActive = false;
    await item.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sell an item (mark as sold and create sold item record)
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
    if (item.seller.toString() !== req.user.id) {
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

    // Create sold item record
    const soldItem = new SoldItem({
      item: item._id,
      seller: item.seller,
      buyer: buyerId,
      itemType: item.itemType,
      itemName: item.itemName,
      itemPrice: item.itemPrice,
      quantitySold: parseFloat(quantitySold),
      unit: item.unit,
      totalAmount,
      image: item.image,
      imagePublicId: item.imagePublicId,
      notes,
    });

    await soldItem.save();

    // Update item quantity
    item.quantity -= parseFloat(quantitySold);

    // If quantity becomes 0, mark as inactive
    if (item.quantity <= 0) {
      item.isActive = false;
    }

    await item.save();

    // Populate the sold item with buyer and seller info
    await soldItem.populate([
      {
        path: "seller",
        select: "firstName lastName username email contactNo address",
      },
      {
        path: "buyer",
        select: "firstName lastName username email contactNo address",
      },
    ]);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Item sold successfully",
      data: soldItem,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sold items by seller
 */
const getSoldItemsBySeller = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const { itemType, page = 1, limit = 20 } = req.query;

    // Build filter object
    const filter = { seller: sellerId };

    if (itemType) {
      filter.itemType = itemType;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const soldItems = await SoldItem.find(filter)
      .populate("buyer", "firstName lastName username email contactNo address")
      .sort({ saleDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalItems = await SoldItem.countDocuments(filter);

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
  } catch (error) {
    next(error);
  }
};

/**
 * Get sold items by buyer
 */
const getSoldItemsByBuyer = async (req, res, next) => {
  try {
    const { buyerId } = req.params;
    const { itemType, page = 1, limit = 20 } = req.query;

    // Build filter object
    const filter = { buyer: buyerId };

    if (itemType) {
      filter.itemType = itemType;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const soldItems = await SoldItem.find(filter)
      .populate("seller", "firstName lastName username email contactNo address")
      .sort({ saleDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalItems = await SoldItem.countDocuments(filter);

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
  sellItem,
  getSoldItemsBySeller,
  getSoldItemsByBuyer,
};
