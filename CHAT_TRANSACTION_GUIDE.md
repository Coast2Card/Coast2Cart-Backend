# Chat Transaction System - Backend Documentation

## 🎯 Overview

This system implements a multi-product transaction chat feature where buyers and sellers can discuss multiple products within a single chat room. Each product has its own transaction with quantity tracking and inventory management.

## 📋 Key Concepts

### **1. One Chat Room Per Buyer-Seller Pair**

- When buyer messages seller for the first time → New chat room created
- When same buyer messages same seller again → Reuses existing chat room
- Chat room persists all conversation history

### **2. Multiple Transactions Per Chat Room**

- Each product inquiry creates a separate transaction
- Example: Buyer orders 2kg Tilapia → Transaction 1
- Same buyer orders 1kg Oyster from same seller → Transaction 2 (same chat room)
- Both transactions visible in the same chat

### **3. Inventory Management**

- Each transaction has a "Mark as Sold" button (seller only)
- When marked as sold → Stock is automatically deducted
- Example: 10kg Tilapia - 2kg sold = 8kg remaining

---

## 🚀 API Endpoints

### **1. Create Chat Room or Add First Transaction**

```
POST /api/chat/rooms
```

**Description:** Creates a new chat room between buyer and seller. If item and quantity are provided, also creates the first transaction.

**Request Body:**

```json
{
  "participantId": "68e64337385d45400b691b39",
  "itemId": "68d6b248b66f08cd248a6f7a",
  "quantity": 2
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "chatRoom": {
      "_id": "68ed33d1723d58fcdd346497",
      "participants": [
        {
          "_id": "68d299a86704bfae7cae3b26",
          "username": "bigboytyrel"
        },
        {
          "_id": "68e64337385d45400b691b39",
          "username": "seller_user"
        }
      ],
      "lastMessage": "New order: 2 kg of Tilapia",
      "lastMessageAt": "2025-10-14T10:30:00.000Z",
      "isActive": true
    },
    "transaction": {
      "_id": "68ed45678abcdef123456789",
      "chatRoomId": "68ed33d1723d58fcdd346497",
      "itemId": {
        "_id": "68d6b248b66f08cd248a6f7a",
        "itemName": "Tilapia",
        "itemPrice": 150,
        "image": "https://...",
        "unit": "kg"
      },
      "buyerId": "68d299a86704bfae7cae3b26",
      "sellerId": "68e64337385d45400b691b39",
      "quantity": 2,
      "unit": "kg",
      "priceAtTransaction": 150,
      "totalPrice": 300,
      "status": "pending",
      "createdAt": "2025-10-14T10:30:00.000Z"
    },
    "isNewChatRoom": true
  }
}
```

---

### **2. Add New Transaction to Existing Chat Room**

```
POST /api/chat/rooms/:chatRoomId/transactions
```

**Description:** Adds a new product transaction to an existing chat room. Use this when buyer wants to order another product from the same seller.

**Request Body:**

```json
{
  "itemId": "68d6b248b66f08cd248a6f8b",
  "quantity": 1
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "_id": "68ed45678abcdef123456790",
    "chatRoomId": "68ed33d1723d58fcdd346497",
    "itemId": {
      "_id": "68d6b248b66f08cd248a6f8b",
      "itemName": "Oyster",
      "itemPrice": 250,
      "image": "https://...",
      "unit": "kg"
    },
    "buyerId": "68d299a86704bfae7cae3b26",
    "sellerId": "68e64337385d45400b691b39",
    "quantity": 1,
    "unit": "kg",
    "priceAtTransaction": 250,
    "totalPrice": 250,
    "status": "pending",
    "createdAt": "2025-10-14T11:00:00.000Z"
  }
}
```

---

### **3. Get All Transactions in Chat Room**

```
GET /api/chat/rooms/:chatRoomId/transactions
```

**Description:** Retrieves all transactions (products) discussed in a chat room.

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "68ed45678abcdef123456789",
      "itemId": {
        "itemName": "Tilapia",
        "itemPrice": 150,
        "image": "https://...",
        "unit": "kg",
        "quantity": 8
      },
      "quantity": 2,
      "totalPrice": 300,
      "status": "sold",
      "markedSoldAt": "2025-10-14T10:45:00.000Z",
      "createdAt": "2025-10-14T10:30:00.000Z"
    },
    {
      "_id": "68ed45678abcdef123456790",
      "itemId": {
        "itemName": "Oyster",
        "itemPrice": 250,
        "image": "https://...",
        "unit": "kg",
        "quantity": 10
      },
      "quantity": 1,
      "totalPrice": 250,
      "status": "pending",
      "markedSoldAt": null,
      "createdAt": "2025-10-14T11:00:00.000Z"
    }
  ]
}
```

---

### **4. Mark Transaction as Sold (SELLER ONLY)**

```
PUT /api/chat/rooms/:chatRoomId/transactions/:transactionId/mark-sold
```

**Description:** Marks a transaction as sold and automatically deducts the quantity from inventory. Only the seller can perform this action.

**Request Body:** None required

**Response (200):**

```json
{
  "success": true,
  "data": {
    "transaction": {
      "_id": "68ed45678abcdef123456790",
      "itemId": "68d6b248b66f08cd248a6f8b",
      "quantity": 1,
      "unit": "kg",
      "totalPrice": 250,
      "status": "sold",
      "markedSoldAt": "2025-10-14T11:15:00.000Z",
      "markedSoldBy": "68e64337385d45400b691b39"
    },
    "updatedStock": 9,
    "message": "Transaction marked as sold and stock updated successfully"
  }
}
```

---

## 🔄 Complete User Flow Example

### **Scenario 1: First Purchase (2kg Tilapia)**

1. **Buyer clicks "Message Seller" with quantity 2kg**

```
POST /api/chat/rooms
{
  "participantId": "seller_id",
  "itemId": "tilapia_id",
  "quantity": 2
}
```

2. **System creates:**

   - ✅ New chat room
   - ✅ Transaction 1 (2kg Tilapia, status: pending)
   - ✅ Automatic product message in chat

3. **Seller sees:**

   - Chat room with buyer
   - Product card: 2kg Tilapia, ₱300
   - "Mark as Sold" button

4. **Seller marks as sold:**

```
PUT /api/chat/rooms/chat_room_id/transactions/transaction_1_id/mark-sold
```

5. **System automatically:**
   - ✅ Updates transaction status: pending → sold
   - ✅ Deducts stock: 10kg → 8kg
   - ✅ Sends system message: "✅ Marked as sold: 2kg of Tilapia. Stock updated: 10kg → 8kg"

---

### **Scenario 2: Second Purchase (1kg Oyster) - SAME CHAT ROOM**

1. **Buyer wants to buy Oyster from same seller**

```
POST /api/chat/rooms/:chatRoomId/transactions
{
  "itemId": "oyster_id",
  "quantity": 1
}
```

2. **System:**

   - ✅ Reuses existing chat room
   - ✅ Creates Transaction 2 (1kg Oyster, status: pending)
   - ✅ Sends new product message in SAME chat
   - ✅ Previous Tilapia transaction still visible

3. **Chat now shows:**

   - Previous conversation history
   - Transaction 1: 2kg Tilapia (SOLD) ✅
   - Transaction 2: 1kg Oyster (PENDING) 🟡
   - Each has its own "Mark as Sold" button

4. **Seller marks Oyster as sold:**

```
PUT /api/chat/rooms/chat_room_id/transactions/transaction_2_id/mark-sold
```

5. **System automatically:**
   - ✅ Updates transaction status: pending → sold
   - ✅ Deducts stock: 10kg → 9kg
   - ✅ Sends system message: "✅ Marked as sold: 1kg of Oyster. Stock updated: 10kg → 9kg"

---

## 📊 Transaction Status Flow

```
PENDING → (Seller clicks "Mark as Sold") → SOLD → (Inventory Updated)
```

- **PENDING** - Transaction created, waiting for seller action
- **SOLD** - Transaction completed, stock deducted
- **CANCELLED** - Transaction cancelled (future feature)

---

## 🔒 Authorization Rules

| Action             | Who Can Do It                               |
| ------------------ | ------------------------------------------- |
| Create chat room   | Anyone (buyer/seller)                       |
| Add transaction    | Chat participants only                      |
| Mark as sold       | Seller only                                 |
| View transactions  | Chat participants only                      |
| Delete transaction | No one (transactions are permanent records) |

---

## ⚠️ Business Rules

1. **Stock Validation:**

   - System checks available stock before creating transaction
   - Prevents ordering more than available quantity
   - Example: 8kg available, buyer orders 10kg → Error

2. **Duplicate Prevention:**

   - Same buyer + same seller = One chat room only
   - Multiple products = Multiple transactions in one chat

3. **Inventory Update:**

   - Stock deducted ONLY when marked as sold
   - Not deducted when transaction is created
   - Prevents inventory locking

4. **Transaction History:**
   - All transactions are permanent records
   - Cannot be deleted, only cancelled (future feature)
   - Provides audit trail

---

## 🎨 Frontend Implementation Guide

### **When User Clicks "Message Seller":**

```javascript
// Step 1: Create chat room or get existing + add transaction
const response = await fetch("/api/chat/rooms", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    participantId: sellerId,
    itemId: productId,
    quantity: selectedQuantity, // From quantity selector
  }),
});

const { chatRoom, transaction, isNewChatRoom } = response.data;

// Step 2: If existing chat room, can also use:
const addTransaction = await fetch(
  `/api/chat/rooms/${chatRoomId}/transactions`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      itemId: newProductId,
      quantity: newQuantity,
    }),
  }
);

// Step 3: Get all transactions for this chat
const transactions = await fetch(`/api/chat/rooms/${chatRoomId}/transactions`, {
  headers: { Authorization: `Bearer ${token}` },
});

// Step 4: Seller marks as sold
const markSold = await fetch(
  `/api/chat/rooms/${chatRoomId}/transactions/${transactionId}/mark-sold`,
  {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  }
);
```

### **UI Display Example:**

```
┌─────────────────────────────────────────────────┐
│ Chat with seller_user                           │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Product Card: Tilapia]                         │
│ 2kg × ₱150/kg = ₱300                            │
│ Status: ✅ SOLD                                 │
│ Marked sold on: Oct 14, 10:45 AM               │
│                                                 │
│ Buyer: Is this fresh?                           │
│ Seller: Yes! Caught this morning!               │
│                                                 │
│ [Product Card: Oyster]                          │
│ 1kg × ₱250/kg = ₱250                            │
│ Status: 🟡 PENDING                              │
│ [Mark as Sold] ← Seller only                    │
│                                                 │
│ Buyer: I'll take 1kg of oyster too!             │
│ Seller: Great! I'll prepare it.                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Type message...]                        [Send] │
└─────────────────────────────────────────────────┘
```

---

## 📝 Error Responses

### **Insufficient Stock:**

```json
{
  "success": false,
  "message": "Not enough stock available. Only 8 kg available."
}
```

### **Unauthorized Mark as Sold:**

```json
{
  "success": false,
  "message": "Only seller can mark transaction as sold"
}
```

### **Already Sold:**

```json
{
  "success": false,
  "message": "Transaction already marked as sold"
}
```

---

## 🎯 Key Benefits

1. ✅ **Single Chat Room** - No chat clutter, one conversation per buyer-seller pair
2. ✅ **Multiple Products** - Discuss and order multiple items in one chat
3. ✅ **Automatic Inventory** - Stock updates automatically when marked sold
4. ✅ **Transaction History** - Full audit trail of all orders
5. ✅ **Clear Status** - Visual indicators for pending/sold transactions
6. ✅ **Price Locking** - Transaction stores price at time of order
7. ✅ **Conversation Preserved** - All previous messages remain visible

---

## 🔧 Backend Implementation Details

### **Models:**

- **ChatRoom** - Manages chat between two users
- **Message** - Individual chat messages
- **Transaction** - Product orders with quantity and status

### **Automatic Features:**

- Product message automatically sent when transaction created
- System message sent when transaction marked as sold
- Stock automatically deducted from inventory
- Chat room last message automatically updated

### **Security:**

- JWT authentication required
- Only seller can mark as sold
- Only chat participants can view transactions
- Stock validation prevents over-ordering
