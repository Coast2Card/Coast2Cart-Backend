const Item = require("../models/Item");
const Receipt = require("../models/Receipt");
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
    if (item.seller.toString() !== req.user.id) {
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

    if (item.seller.toString() !== req.user.id) {
      return next(new UnauthorizedError("You can only update your own items"));
    }

    item.isActive = isActive;
    await item.save();

    const populated = await item.populate(
      "seller",
      "firstName lastName username email contactNo address"
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Item status updated",
      data: populated,
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
    if (item.seller.toString() !== req.user.id) {
      return next(new UnauthorizedError("You can only delete your own items"));
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

  // Create receipt record
  const receipt = new Receipt({
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

    await receipt.save();

    // Update item quantity
    item.quantity -= parseFloat(quantitySold);

    // If quantity becomes 0, mark as inactive
    if (item.quantity <= 0) {
      item.isActive = false;
    }

    await item.save();

    // Populate the receipt with buyer and seller info
    await receipt.populate([
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
      data: receipt,
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
  const soldItems = await Receipt.find(filter)
      .populate("buyer", "firstName lastName username email contactNo address")
      .sort({ saleDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
  const totalItems = await Receipt.countDocuments(filter);

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
  const soldItems = await Receipt.find(filter)
      .populate("seller", "firstName lastName username email contactNo address")
      .sort({ saleDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
  const totalItems = await Receipt.countDocuments(filter);

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
  setItemActiveStatus,
  sellItem,
  getSoldItemsBySeller,
  getSoldItemsByBuyer,
};
