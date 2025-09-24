const Cart = require("../models/Cart");
const Item = require("../models/Item");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");
const { StatusCodes } = require("http-status-codes");

/**
 * Add item to cart
 */
const addToCart = async (req, res, next) => {
  try {
    const { itemId, quantity } = req.body;

    // Validate required fields
    if (!itemId || !quantity) {
      return next(new BadRequestError("Item ID and quantity are required"));
    }

    // Validate quantity
    const parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return next(new BadRequestError("Quantity must be a positive number"));
    }

    // Find the item
    const item = await Item.findById(itemId);
    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Check if item is active
    if (!item.isActive) {
      return next(new BadRequestError("Item is no longer available"));
    }

    // Check if sufficient quantity is available
    if (parsedQuantity > item.quantity) {
      return next(new BadRequestError("Insufficient quantity available"));
    }

    // Check if user is trying to add their own item
    if (item.seller.toString() === req.user.id) {
      return next(new BadRequestError("You cannot add your own items to cart"));
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      // Create new cart
      cart = new Cart({
        user: req.user.id,
        items: []
      });
    }

    // Check if item already exists in cart
    const existingCartItem = cart.findItem(itemId);

    if (existingCartItem) {
      // Update existing cart item
      const newQuantity = existingCartItem.quantity + parsedQuantity;

      // Check if new total quantity exceeds available stock
      if (newQuantity > item.quantity) {
        return next(
          new BadRequestError("Total quantity exceeds available stock")
        );
      }

      cart.updateItemQuantity(itemId, newQuantity);
    } else {
      // Add new item to cart
      cart.addItem(itemId, parsedQuantity);
    }

    await cart.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: existingCartItem ? "Cart item updated successfully" : "Item added to cart successfully",
      data: {
        itemId,
        quantity: existingCartItem ? existingCartItem.quantity + parsedQuantity : parsedQuantity,
        addedAt: cart.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's cart
 */
const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: "items.item",
        populate: {
          path: "seller",
          select: "firstName lastName username email contactNo address",
        },
      });

    if (!cart) {
      // Return empty cart if none exists
      return res.status(StatusCodes.OK).json({
        success: true,
        data: [],
        cartTotal: 0,
        itemCount: 0,
        sellerCount: 0,
      });
    }

    // Calculate totals and format data
    let cartTotal = 0;
    const sellerIds = new Set();

    const cartData = cart.items
      .map((cartItem) => {
        if (cartItem.item) {
          const totalPrice = cartItem.item.itemPrice * cartItem.quantity;
          cartTotal += totalPrice;
          sellerIds.add(cartItem.item.seller._id.toString());

          return {
            itemId: cartItem.item._id,
            item: {
              _id: cartItem.item._id,
              itemName: cartItem.item.itemName,
              itemPrice: cartItem.item.itemPrice,
              unit: cartItem.item.unit,
              image: cartItem.item.image,
              seller: cartItem.item.seller,
            },
            quantity: cartItem.quantity,
            totalPrice,
            addedAt: cart.createdAt,
          };
        }
        return null;
      })
      .filter(Boolean);

    res.status(StatusCodes.OK).json({
      success: true,
      data: cartData,
      cartTotal,
      itemCount: cart.items.length,
      sellerCount: sellerIds.size,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update cart item quantity
 */
const updateCartItem = async (req, res, next) => {
  try {
    const { itemId, quantity } = req.body;

    // Validate required fields
    if (!itemId || quantity === undefined) {
      return next(new BadRequestError("Item ID and quantity are required"));
    }

    // Validate quantity
    const parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return next(
        new BadRequestError("Quantity must be a non-negative number")
      );
    }

    // Find user's cart
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new NotFoundError("Cart not found"));
    }

    // Check if item exists in cart
    const existingCartItem = cart.findItem(itemId);
    if (!existingCartItem) {
      return next(new NotFoundError("Item not found in cart"));
    }

    // If quantity is 0, remove item from cart
    if (parsedQuantity === 0) {
      cart.removeItem(itemId);
      await cart.save();
      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Item removed from cart successfully",
      });
    }

    // Find the item to check availability
    const item = await Item.findById(itemId);
    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    if (!item.isActive) {
      return next(new BadRequestError("Item is no longer available"));
    }

    // Check if quantity exceeds available stock
    if (parsedQuantity > item.quantity) {
      return next(new BadRequestError("Insufficient quantity available"));
    }

    // Update cart item
    cart.updateItemQuantity(itemId, parsedQuantity);
    await cart.save();

    const totalPrice = item.itemPrice * parsedQuantity;

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Cart item updated successfully",
      data: {
        itemId,
        quantity: parsedQuantity,
        totalPrice,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove item from cart
 */
const removeFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    if (!itemId) {
      return next(new BadRequestError("Item ID is required"));
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new NotFoundError("Cart not found"));
    }

    const existingCartItem = cart.findItem(itemId);
    if (!existingCartItem) {
      return next(new NotFoundError("Item not found in cart"));
    }

    cart.removeItem(itemId);
    await cart.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Item removed from cart successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear entire cart
 */
const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new NotFoundError("Cart not found"));
    }

    cart.clearItems();
    await cart.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get cart summary
 */
const getCartSummary = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate("items.item", "itemPrice seller");

    if (!cart) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: {
          itemCount: 0,
          sellerCount: 0,
          cartTotal: 0,
          formattedTotal: "₱0.00",
        },
      });
    }

    let cartTotal = 0;
    const sellerIds = new Set();

    cart.items.forEach((cartItem) => {
      if (cartItem.item) {
        cartTotal += cartItem.item.itemPrice * cartItem.quantity;
        sellerIds.add(cartItem.item.seller.toString());
      }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        itemCount: cart.items.length,
        sellerCount: sellerIds.size,
        cartTotal,
        formattedTotal: `₱${cartTotal.toFixed(2)}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary,
};