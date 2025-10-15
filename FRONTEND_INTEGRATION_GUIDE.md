# 🚀 Chat System - Frontend Integration Guide

## 📋 **Complete API Routes Table**

| Method     | Endpoint                                                            | Purpose                              | Sample Request Body                                                           | Sample Response                                                                                              |
| ---------- | ------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **POST**   | `/api/chat/rooms`                                                   | Create chat room + first transaction | `{"participantId": "seller_id", "itemId": "product_id", "quantity": 2}`       | `{"success": true, "data": {"chatRoom": {...}, "transaction": {...}, "isNewChatRoom": true}}`                |
| **POST**   | `/api/chat/rooms/:chatRoomId/transactions`                          | Add new product to existing chat     | `{"itemId": "product_id", "quantity": 1}`                                     | `{"success": true, "data": {"_id": "...", "quantity": 1, "totalPrice": 250, "status": "pending"}}`           |
| **GET**    | `/api/chat/rooms`                                                   | Get all user's chat rooms            | None                                                                          | `{"success": true, "data": [{"_id": "...", "participants": [...], "lastMessage": "...", "unreadCount": 2}]}` |
| **GET**    | `/api/chat/rooms/:chatRoomId/transactions`                          | Get all transactions in chat         | None                                                                          | `{"success": true, "data": [{"_id": "...", "itemId": {...}, "quantity": 2, "status": "pending"}]}`           |
| **PUT**    | `/api/chat/rooms/:chatRoomId/transactions/:transactionId/mark-sold` | Mark as sold (Seller only)           | None                                                                          | `{"success": true, "data": {"transaction": {...}, "updatedStock": 8, "message": "Stock updated"}}`           |
| **POST**   | `/api/chat/messages`                                                | Send text message                    | `{"chatRoomId": "...", "messageType": "text", "content": {"text": "Hello!"}}` | `{"success": true, "data": {"_id": "...", "content": {"text": "Hello!"}}}`                                   |
| **GET**    | `/api/chat/rooms/:chatRoomId/messages`                              | Get chat messages                    | Query: `?page=1&limit=50`                                                     | `{"success": true, "data": [...]}`                                                                           |
| **PUT**    | `/api/chat/rooms/:chatRoomId/messages/read`                         | Mark messages as read                | None                                                                          | `{"success": true, "message": "Messages marked as read"}`                                                    |
| **DELETE** | `/api/chat/messages/:messageId`                                     | Delete message                       | None                                                                          | `{"success": true, "message": "Message deleted successfully"}`                                               |

---

## 🎯 **User Flow Implementation**

### **Flow 1: First Time Buyer Messages Seller (2kg Tilapia)**

#### **Step 1: User clicks "Message Seller" button**

```javascript
// Frontend captures:
const sellerId = product.seller._id;
const productId = product._id;
const quantity = 2; // From quantity selector

// API call:
const response = await fetch("/api/chat/rooms", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    participantId: sellerId,
    itemId: productId,
    quantity: quantity,
  }),
});

const result = await response.json();
// result.data.chatRoom._id → Chat room ID
// result.data.transaction → Transaction details
// result.data.isNewChatRoom → true (first time)
```

#### **Step 2: Frontend displays chat**

```javascript
// Fetch transactions for this chat
const transactions = await fetch(`/api/chat/rooms/${chatRoomId}/transactions`, {
  headers: { Authorization: `Bearer ${token}` },
});

// Display in chat:
// - Transaction 1: 2kg Tilapia, ₱300, Status: PENDING
// - Show "Mark as Sold" button (if user is seller)
```

#### **Step 3: Seller marks as sold**

```javascript
const markSold = await fetch(
  `/api/chat/rooms/${chatRoomId}/transactions/${transactionId}/mark-sold`,
  {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  }
);

const result = await markSold.json();
// result.data.updatedStock → 8 (10kg - 2kg)
// result.data.transaction.status → "sold"
// Show success message: "Stock updated: 10kg → 8kg"
```

---

### **Flow 2: Same Buyer Orders Another Product (1kg Oyster)**

#### **Step 1: User clicks "Message Seller" again (different product)**

```javascript
// Frontend checks if chat room exists with this seller
const existingChat = chatRooms.find((chat) =>
  chat.participants.includes(sellerId)
);

if (existingChat) {
  // Use existing chat room
  const response = await fetch(
    `/api/chat/rooms/${existingChat._id}/transactions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        itemId: oysterProductId,
        quantity: 1,
      }),
    }
  );

  // Redirect to existing chat room
  navigate(`/chat/${existingChat._id}`);
} else {
  // Create new chat room (first time with this seller)
  // Use POST /api/chat/rooms
}
```

#### **Step 2: Frontend displays both transactions**

```javascript
// Fetch all transactions
const transactions = await fetch(`/api/chat/rooms/${chatRoomId}/transactions`, {
  headers: { Authorization: `Bearer ${token}` },
});

// Display in chat:
// - Transaction 1: 2kg Tilapia, SOLD ✅
// - Transaction 2: 1kg Oyster, PENDING 🟡 [Mark as Sold]
// - All previous messages preserved
```

---

## 📊 **Transaction Object Structure**

```javascript
{
  _id: "transaction_id",
  chatRoomId: "chat_room_id",
  itemId: {
    _id: "product_id",
    itemName: "Tilapia",
    itemPrice: 150,
    image: "https://...",
    unit: "kg",
    quantity: 8  // Current stock
  },
  buyerId: "buyer_user_id",
  sellerId: "seller_user_id",
  quantity: 2,  // Ordered quantity
  unit: "kg",
  priceAtTransaction: 150,  // Price when ordered
  totalPrice: 300,  // quantity × priceAtTransaction
  status: "pending" | "sold" | "cancelled",
  markedSoldAt: "2025-10-14T10:45:00.000Z",
  markedSoldBy: "seller_user_id",
  createdAt: "2025-10-14T10:30:00.000Z"
}
```

---

## 🎨 **Frontend Component Structure**

### **Chat Room Component:**

```javascript
const ChatRoom = ({ chatRoomId }) => {
  const [messages, setMessages] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    // Fetch messages
    fetchMessages(chatRoomId);

    // Fetch transactions
    fetchTransactions(chatRoomId);
  }, [chatRoomId]);

  return (
    <div>
      {/* Display all transactions */}
      {transactions.map((transaction) => (
        <TransactionCard
          key={transaction._id}
          transaction={transaction}
          onMarkSold={handleMarkSold}
        />
      ))}

      {/* Display messages */}
      {messages.map((message) => (
        <MessageBubble key={message._id} message={message} />
      ))}
    </div>
  );
};
```

### **Transaction Card Component:**

```javascript
const TransactionCard = ({ transaction, onMarkSold }) => {
  const isSeller = currentUser._id === transaction.sellerId;
  const canMarkSold = isSeller && transaction.status === "pending";

  return (
    <div className="transaction-card">
      <img src={transaction.itemId.image} />
      <h3>{transaction.itemId.itemName}</h3>
      <p>
        {transaction.quantity} {transaction.unit} × ₱
        {transaction.priceAtTransaction}
      </p>
      <p>Total: ₱{transaction.totalPrice}</p>
      <p>Status: {transaction.status === "sold" ? "✅ SOLD" : "🟡 PENDING"}</p>

      {canMarkSold && (
        <button onClick={() => onMarkSold(transaction._id)}>
          Mark as Sold
        </button>
      )}

      {transaction.status === "sold" && (
        <p>Sold on: {new Date(transaction.markedSoldAt).toLocaleString()}</p>
      )}
    </div>
  );
};
```

---

## ⚡ **Real-time Updates with Socket.io**

### **Listen for Transaction Updates:**

```javascript
socket.on("transaction_updated", (data) => {
  // Update transaction in UI
  updateTransaction(data.transaction);

  // Show notification
  if (data.transaction.status === "sold") {
    showNotification(`Transaction completed! Stock updated.`);
  }
});

socket.on("new_transaction", (data) => {
  // Add new transaction to list
  addTransaction(data.transaction);

  // Show notification
  showNotification(
    `New order: ${data.transaction.quantity} ${data.transaction.unit}`
  );
});
```

---

## 🔔 **Important Notes for Frontend Team**

1. **Chat Room Reuse:**

   - Always check if chat room exists before creating new one
   - Use `GET /api/chat/rooms` to find existing chats
   - If found, use `POST /transactions` to add new product
   - If not found, use `POST /rooms` to create new chat

2. **Transaction Display:**

   - Show ALL transactions in the chat UI
   - Each transaction should have its own card/component
   - Display status badges (Pending/Sold)
   - Show "Mark as Sold" button only to sellers for pending transactions

3. **Stock Updates:**

   - Stock is NOT deducted when transaction is created
   - Stock IS deducted when marked as sold
   - Display updated stock in real-time after marking sold

4. **Message vs Transaction:**

   - Transactions appear as special message cards
   - Regular text messages appear normally
   - Both are stored in the messages array
   - Filter by `messageType === 'product'` to find transaction messages

5. **User Roles:**
   - Buyer: Can create transactions, view status
   - Seller: Can mark as sold, view all transactions
   - Both: Can send text messages in the chat

---

## 🎯 **Testing Checklist**

- [ ] Create chat room with product and quantity
- [ ] Verify transaction created automatically
- [ ] Send text messages in chat
- [ ] Add second product to same chat room
- [ ] Verify both transactions visible
- [ ] Seller marks first transaction as sold
- [ ] Verify stock updated correctly
- [ ] Seller marks second transaction as sold
- [ ] Verify both transactions show "SOLD" status
- [ ] Check previous messages preserved
