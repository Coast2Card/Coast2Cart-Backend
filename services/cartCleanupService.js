const Cart = require("../models/Cart");
const Item = require("../models/Item");

/**
 * Remove a specific item from all user carts
 * @param {string} itemId - The ID of the item to remove
 * @param {string} reason - Reason for removal (e.g., 'sold', 'inactive', 'deleted')
 * @returns {Promise<Object>} - Result object with affected carts count
 */
const removeItemFromAllCarts = async (itemId, reason = 'unavailable') => {
  try {
    // Find all carts that contain this item
    const cartsWithItem = await Cart.find({
      'items.item': itemId
    });

    if (cartsWithItem.length === 0) {
      return {
        success: true,
        message: 'No carts found containing this item',
        affectedCarts: 0,
        reason
      };
    }

    // Remove the item from all carts
    const updateResult = await Cart.updateMany(
      { 'items.item': itemId },
      { $pull: { items: { item: itemId } } }
    );

    console.log(`Cart cleanup: Removed item ${itemId} from ${updateResult.modifiedCount} carts. Reason: ${reason}`);

    return {
      success: true,
      message: `Successfully removed item from ${updateResult.modifiedCount} carts`,
      affectedCarts: updateResult.modifiedCount,
      reason
    };
  } catch (error) {
    console.error('Error removing item from carts:', error);
    throw error;
  }
};

/**
 * Remove a specific item from a specific user's cart
 * @param {string} itemId - The ID of the item to remove
 * @param {string} userId - The ID of the user whose cart to update
 * @param {string} reason - Reason for removal
 * @returns {Promise<Object>} - Result object
 */
const removeItemFromUserCart = async (itemId, userId, reason = 'unavailable') => {
  try {
    const cart = await Cart.findOne({ user: userId });
    
    if (!cart) {
      return {
        success: true,
        message: 'User cart not found',
        affectedCarts: 0,
        reason
      };
    }

    const cartItem = cart.findItem(itemId);
    if (!cartItem) {
      return {
        success: true,
        message: 'Item not found in user cart',
        affectedCarts: 0,
        reason
      };
    }

    cart.removeItem(itemId);
    await cart.save();

    console.log(`Cart cleanup: Removed item ${itemId} from user ${userId} cart. Reason: ${reason}`);

    return {
      success: true,
      message: 'Successfully removed item from user cart',
      affectedCarts: 1,
      reason
    };
  } catch (error) {
    console.error('Error removing item from user cart:', error);
    throw error;
  }
};

/**
 * Clean up carts by removing items that are no longer active or available
 * @param {string} itemId - The ID of the item to check
 * @returns {Promise<Object>} - Result object
 */
const cleanupCartsForInactiveItem = async (itemId) => {
  try {
    const item = await Item.findById(itemId);
    
    if (!item) {
      return {
        success: true,
        message: 'Item not found',
        affectedCarts: 0,
        reason: 'item_not_found'
      };
    }

    // If item is inactive or has no quantity, remove from all carts
    if (!item.isActive || item.quantity <= 0) {
      return await removeItemFromAllCarts(itemId, 'inactive');
    }

    return {
      success: true,
      message: 'Item is still active, no cleanup needed',
      affectedCarts: 0,
      reason: 'item_active'
    };
  } catch (error) {
    console.error('Error cleaning up carts for inactive item:', error);
    throw error;
  }
};

/**
 * Update cart quantities when item stock is reduced
 * @param {string} itemId - The ID of the item
 * @param {number} newQuantity - The new available quantity
 * @returns {Promise<Object>} - Result object
 */
const updateCartQuantitiesForReducedStock = async (itemId, newQuantity) => {
  try {
    // Find all carts that contain this item
    const cartsWithItem = await Cart.find({
      'items.item': itemId
    });

    if (cartsWithItem.length === 0) {
      return {
        success: true,
        message: 'No carts found containing this item',
        affectedCarts: 0,
        reason: 'no_carts'
      };
    }

    let totalAffectedCarts = 0;
    const results = [];

    for (const cart of cartsWithItem) {
      const cartItem = cart.findItem(itemId);
      if (cartItem && cartItem.quantity > newQuantity) {
        if (newQuantity <= 0) {
          // Remove item completely if no stock left
          cart.removeItem(itemId);
          results.push({
            userId: cart.user,
            action: 'removed',
            previousQuantity: cartItem.quantity,
            newQuantity: 0
          });
        } else {
          // Reduce quantity to available stock
          cart.updateItemQuantity(itemId, newQuantity);
          results.push({
            userId: cart.user,
            action: 'reduced',
            previousQuantity: cartItem.quantity,
            newQuantity: newQuantity
          });
        }
        await cart.save();
        totalAffectedCarts++;
      }
    }

    console.log(`Cart cleanup: Updated quantities for item ${itemId} in ${totalAffectedCarts} carts. New stock: ${newQuantity}`);

    return {
      success: true,
      message: `Updated quantities in ${totalAffectedCarts} carts`,
      affectedCarts: totalAffectedCarts,
      reason: 'stock_reduced',
      details: results
    };
  } catch (error) {
    console.error('Error updating cart quantities:', error);
    throw error;
  }
};

module.exports = {
  removeItemFromAllCarts,
  removeItemFromUserCart,
  cleanupCartsForInactiveItem,
  updateCartQuantitiesForReducedStock
};
