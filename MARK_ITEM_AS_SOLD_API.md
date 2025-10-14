# Mark Item as Sold API

## Overview
This API endpoint allows sellers to mark items as sold within chat rooms, automatically reducing the item's available quantity, creating a SoldItem record for transaction tracking, and creating a transaction message in the chat.

## Endpoint
```
POST /api/chat/rooms/:chatRoomId/mark-sold
```

## Authentication
- Requires valid JWT token
- Requires seller role (`role: "seller"`)
- Seller account must be fully validated (`status: "validated"`)
- Only the seller of the item can mark it as sold

## Request Parameters

### Path Parameters
- `chatRoomId` (string, required): The ID of the chat room containing the item

### Request Body
```json
{}
```

**Note:** No request body is required. The system automatically uses the current available quantity of the item in the chat room.

## Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Item marked as sold successfully",
  "data": {
    "soldQuantity": 10,
    "remainingQuantity": 0,
        "totalPrice": 1500.00,
        "soldItem": {
          "_id": "sold_item_id",
          "itemName": "Fresh Tuna",
          "quantitySold": 10,
          "unit": "kg",
          "totalAmount": 1500.00,
          "saleDate": "2024-01-01T00:00:00.000Z"
        },
        "soldMessage": {
      "_id": "message_id",
      "chatRoomId": "chat_room_id",
      "senderId": "seller_id",
      "messageType": "text",
      "content": {
        "text": "✅ Item marked as sold: 10 kg of Fresh Tuna for ₱1500.00. Item is now sold out."
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "senderId": {
        "_id": "seller_id",
        "username": "seller_username",
        "profilePicture": "profile_pic_url"
      }
    },
    "updatedItem": {
      "_id": "item_id",
      "itemName": "Fresh Tuna",
      "quantity": 0,
      "unit": "kg",
      "isSoldOut": true
    }
  }
}
```

### Error Responses

#### 400 Bad Request - Item Already Sold Out
```json
{
  "success": false,
  "message": "Item is already sold out"
}
```

#### 400 Bad Request - Insufficient Quantity
```json
{
  "success": false,
  "message": "Insufficient quantity. Available: 2 kg, Requested: 5 kg"
}
```

#### 400 Bad Request - No Associated Item
```json
{
  "success": false,
  "message": "This chat room is not associated with any item"
}
```

#### 400 Bad Request - Inactive Item
```json
{
  "success": false,
  "message": "Cannot mark inactive items as sold"
}
```

#### 401 Unauthorized - Insufficient Permissions (Not Seller Role)
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

#### 401 Unauthorized - Seller Not Validated
```json
{
  "success": false,
  "message": "Seller account must be fully validated to mark items as sold"
}
```

#### 401 Unauthorized - Not Item Seller
```json
{
  "success": false,
  "message": "Only the seller can mark items as sold"
}
```

#### 401 Unauthorized - Not Chat Participant
```json
{
  "success": false,
  "message": "Not authorized to access this chat"
}
```

## Features

### Automatic Quantity Deduction
- Automatically sells the requested quantity from the chat room
- Reduces the item's available quantity by the requested amount
- Uses MongoDB transactions to ensure data consistency

### SoldItem Record Creation
- Automatically creates a SoldItem record for transaction tracking
- Records seller, buyer, item details, quantity sold, and total amount
- Includes sale date and all relevant transaction information

### Chat Message Creation
- Automatically creates a message in the chat room documenting the sale
- Message includes:
  - Quantity sold
  - Total price
  - Remaining quantity
  - Visual indicator (✅)

### Chat Room Updates
- Updates the chat room's last message to reflect the sale
- Updates the last message timestamp

### Transaction Safety
- Uses MongoDB transactions to ensure atomicity
- If any part of the operation fails, all changes are rolled back

## Usage Examples

### Mark entire item as sold
```bash
curl -X POST \
  http://localhost:3000/api/chat/rooms/CHAT_ROOM_ID/mark-sold \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Note:** No request body is needed - the system automatically sells the entire available quantity.

## Business Logic

1. **Authentication**: Ensures the user is authenticated with valid JWT token
2. **Role Authorization**: Verifies the user has seller role (`role: "seller"`)
3. **Seller Status Validation**: Confirms seller account is fully validated (`status: "validated"`)
4. **Item Verification**: Confirms the chat room has an associated item
5. **Ownership Check**: Verifies only the item's seller can mark it as sold
6. **Quantity Check**: Ensures item has available quantity (not already sold out)
7. **Buyer Identification**: Identifies the buyer from chat room participants
8. **SoldItem Creation**: Creates a SoldItem record for transaction tracking
9. **Automatic Sale**: Sells the requested quantity and reduces item quantity
10. **Transaction**: Atomically creates SoldItem record, updates item quantity, and creates chat message
11. **Notification**: Updates chat room with sale information

## Integration Notes

- This endpoint works seamlessly with the existing chat system
- The created message will appear in real-time if Socket.io is implemented
- The item's quantity reduction is immediately reflected in all item listings
- Chat participants will see the sale notification in their chat history
