# Chat System API Documentation

## Overview

This document provides comprehensive API documentation for the Coast2Cart chat system, including REST endpoints and Socket.io events for real-time messaging between buyers and sellers.

## Base URL

```
http://localhost:5000/api/chat
```

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Socket.io Connection

For real-time messaging, connect to:

```
http://localhost:5000
```

## REST API Endpoints

### 1. Create or Get Chat Room

**Endpoint:** `POST /api/chat/rooms`

**Description:** Creates a new chat room between two users or returns existing chat room if it already exists.

**Request Body:**

```json
{
  "participantId": "64f8b1234567890abcdef123",
  "itemId": "64f8b1234567890abcdef456"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "_id": "64f8b1234567890abcdef789",
    "participants": [
      {
        "_id": "64f8b1234567890abcdef123",
        "username": "buyer_user",
        "profilePicture": "https://example.com/profile.jpg"
      },
      {
        "_id": "64f8b1234567890abcdef456",
        "username": "seller_user",
        "profilePicture": "https://example.com/seller.jpg"
      }
    ],
    "itemId": {
      "_id": "64f8b1234567890abcdef456",
      "name": "Fresh Bangus",
      "price": "₱289/kg",
      "images": ["https://example.com/bangus.jpg"]
    },
    "lastMessage": "",
    "lastMessageAt": "2024-01-15T10:30:00.000Z",
    "unreadCount": 0,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Postman Example:**

```
POST http://localhost:5000/api/chat/rooms
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json

Body (raw JSON):
{
  "participantId": "64f8b1234567890abcdef123",
  "itemId": "64f8b1234567890abcdef456"
}
```

---

### 2. Get User's Chat Rooms

**Endpoint:** `GET /api/chat/rooms`

**Description:** Retrieves all chat rooms for the authenticated user, sorted by last message time.

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8b1234567890abcdef789",
      "participants": [
        {
          "_id": "64f8b1234567890abcdef123",
          "username": "buyer_user",
          "profilePicture": "https://example.com/profile.jpg"
        },
        {
          "_id": "64f8b1234567890abcdef456",
          "username": "seller_user",
          "profilePicture": "https://example.com/seller.jpg"
        }
      ],
      "itemId": {
        "_id": "64f8b1234567890abcdef456",
        "name": "Fresh Bangus",
        "price": "₱289/kg"
      },
      "lastMessage": "Hi, is this still available?",
      "lastMessageAt": "2024-01-15T14:30:00.000Z",
      "unreadCount": 2,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T14:30:00.000Z"
    }
  ]
}
```

**Postman Example:**

```
GET http://localhost:5000/api/chat/rooms
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 3. Get Chat Room Details

**Endpoint:** `GET /api/chat/rooms/:chatRoomId`

**Description:** Gets detailed information about a specific chat room.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "_id": "64f8b1234567890abcdef789",
    "participants": [
      {
        "_id": "64f8b1234567890abcdef123",
        "username": "buyer_user",
        "profilePicture": "https://example.com/profile.jpg"
      },
      {
        "_id": "64f8b1234567890abcdef456",
        "username": "seller_user",
        "profilePicture": "https://example.com/seller.jpg"
      }
    ],
    "itemId": {
      "_id": "64f8b1234567890abcdef456",
      "name": "Fresh Bangus",
      "price": "₱289/kg",
      "images": ["https://example.com/bangus.jpg"]
    },
    "lastMessage": "Yes, still available!",
    "lastMessageAt": "2024-01-15T14:35:00.000Z",
    "unreadCount": 0,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T14:35:00.000Z"
  }
}
```

**Postman Example:**

```
GET http://localhost:5000/api/chat/rooms/64f8b1234567890abcdef789
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 4. Get Chat Messages

**Endpoint:** `GET /api/chat/rooms/:chatRoomId/messages`

**Description:** Retrieves messages for a specific chat room with pagination support.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50, max: 100)

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8b1234567890abcdef001",
      "chatRoomId": "64f8b1234567890abcdef789",
      "senderId": {
        "_id": "64f8b1234567890abcdef123",
        "username": "buyer_user",
        "profilePicture": "https://example.com/profile.jpg"
      },
      "messageType": "product",
      "content": {
        "product": {
          "productId": "64f8b1234567890abcdef456",
          "name": "Fresh Bangus",
          "description": "Fresh Chilled Milkfish All Sizes",
          "price": "₱289/kg",
          "image": "https://example.com/bangus.jpg"
        }
      },
      "readBy": [
        {
          "userId": "64f8b1234567890abcdef123",
          "readAt": "2024-01-15T10:30:00.000Z"
        },
        {
          "userId": "64f8b1234567890abcdef456",
          "readAt": "2024-01-15T10:31:00.000Z"
        }
      ],
      "isEdited": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "_id": "64f8b1234567890abcdef002",
      "chatRoomId": "64f8b1234567890abcdef789",
      "senderId": {
        "_id": "64f8b1234567890abcdef456",
        "username": "seller_user",
        "profilePicture": "https://example.com/seller.jpg"
      },
      "messageType": "text",
      "content": {
        "text": "Hi! Yes, the bangus is still available. How many kilos do you need?"
      },
      "readBy": [
        {
          "userId": "64f8b1234567890abcdef456",
          "readAt": "2024-01-15T10:32:00.000Z"
        },
        {
          "userId": "64f8b1234567890abcdef123",
          "readAt": "2024-01-15T10:33:00.000Z"
        }
      ],
      "isEdited": false,
      "createdAt": "2024-01-15T10:32:00.000Z",
      "updatedAt": "2024-01-15T10:32:00.000Z"
    }
  ]
}
```

**Postman Example:**

```
GET http://localhost:5000/api/chat/rooms/64f8b1234567890abcdef789/messages?page=1&limit=20
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 5. Send Message (REST)

**Endpoint:** `POST /api/chat/messages`

**Description:** Sends a message to a chat room. Note: Use Socket.io for real-time messaging.

**Request Body Examples:**

**Text Message:**

```json
{
  "chatRoomId": "64f8b1234567890abcdef789",
  "messageType": "text",
  "content": {
    "text": "Hello! Is this item still available?"
  }
}
```

**Product Message (Simplified):**

```json
{
  "chatRoomId": "64f8b1234567890abcdef789",
  "messageType": "product",
  "content": {
    "productId": "64f8b1234567890abcdef456"
  }
}
```

**Product Message (Legacy - Still Supported):**

```json
{
  "chatRoomId": "64f8b1234567890abcdef789",
  "messageType": "product",
  "content": {
    "product": {
      "productId": "64f8b1234567890abcdef456",
      "name": "Fresh Bangus",
      "description": "Fresh Chilled Milkfish All Sizes",
      "price": "₱289/kg",
      "image": "https://example.com/bangus.jpg"
    }
  }
}
```

**Image Message:**

```json
{
  "chatRoomId": "64f8b1234567890abcdef789",
  "messageType": "image",
  "content": {
    "imageUrl": "https://example.com/image.jpg"
  }
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "_id": "64f8b1234567890abcdef003",
    "chatRoomId": "64f8b1234567890abcdef789",
    "senderId": {
      "_id": "64f8b1234567890abcdef123",
      "username": "buyer_user",
      "profilePicture": "https://example.com/profile.jpg"
    },
    "messageType": "text",
    "content": {
      "text": "Hello! Is this item still available?"
    },
    "readBy": [
      {
        "userId": "64f8b1234567890abcdef123",
        "readAt": "2024-01-15T15:00:00.000Z"
      }
    ],
    "isEdited": false,
    "createdAt": "2024-01-15T15:00:00.000Z",
    "updatedAt": "2024-01-15T15:00:00.000Z"
  }
}
```

**Postman Example:**

```
POST http://localhost:5000/api/chat/messages
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json

Body (raw JSON):
{
  "chatRoomId": "64f8b1234567890abcdef789",
  "messageType": "text",
  "content": {
    "text": "Hello! Is this item still available?"
  }
}
```

---

### 6. Mark Messages as Read

**Endpoint:** `PUT /api/chat/rooms/:chatRoomId/read`

**Description:** Marks all messages in a chat room as read for the authenticated user.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Messages marked as read"
}
```

**Postman Example:**

```
PUT http://localhost:5000/api/chat/rooms/64f8b1234567890abcdef789/read
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 7. Delete Message

**Endpoint:** `DELETE /api/chat/messages/:messageId`

**Description:** Deletes a message. Only the sender can delete their own messages.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

**Postman Example:**

```
DELETE http://localhost:5000/api/chat/messages/64f8b1234567890abcdef003
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Socket.io Events

### Client → Server Events

#### 1. Authenticate

```javascript
socket.emit("authenticate", {
  token: "your_jwt_token",
});
```

#### 2. Join Chat Room

```javascript
socket.emit("join_chat", {
  chatRoomId: "64f8b1234567890abcdef789",
});
```

#### 3. Send Message

```javascript
// Text message
socket.emit("send_message", {
  chatRoomId: "64f8b1234567890abcdef789",
  messageType: "text",
  content: {
    text: "Hello!",
  },
});

// Product message
socket.emit("send_message", {
  chatRoomId: "64f8b1234567890abcdef789",
  messageType: "product",
  content: {
    product: {
      productId: "64f8b1234567890abcdef456",
      name: "Fresh Bangus",
      description: "Fresh Chilled Milkfish All Sizes",
      price: "₱289/kg",
      image: "https://example.com/bangus.jpg",
    },
  },
});
```

#### 4. Typing Indicators

```javascript
// Start typing
socket.emit("typing_start", {
  chatRoomId: "64f8b1234567890abcdef789",
});

// Stop typing
socket.emit("typing_stop", {
  chatRoomId: "64f8b1234567890abcdef789",
});
```

#### 5. Mark Message as Read

```javascript
socket.emit("mark_read", {
  messageId: "64f8b1234567890abcdef003",
});
```

### Server → Client Events

#### 1. Authentication Success

```javascript
socket.on("authenticated", (data) => {
  console.log("Authenticated:", data);
  // { userId: '64f8b1234567890abcdef123', message: 'Successfully authenticated' }
});
```

#### 2. New Message

```javascript
socket.on("new_message", (data) => {
  console.log("New message:", data);
  // {
  //   message: { _id, chatRoomId, senderId, messageType, content, readBy, ... },
  //   chatRoomId: '64f8b1234567890abcdef789'
  // }
});
```

#### 3. Message Notification

```javascript
socket.on("message_notification", (data) => {
  console.log("Message notification:", data);
  // {
  //   chatRoomId: '64f8b1234567890abcdef789',
  //   message: { ... },
  //   unreadCount: 1
  // }
});
```

#### 4. User Status

```javascript
socket.on("user_status", (data) => {
  console.log("User status:", data);
  // { userId: '64f8b1234567890abcdef456', isOnline: true }
});
```

#### 5. Typing Indicator

```javascript
socket.on("user_typing", (data) => {
  console.log("User typing:", data);
  // { userId: '64f8b1234567890abcdef456', isTyping: true }
});
```

#### 6. Message Read Receipt

```javascript
socket.on("message_read", (data) => {
  console.log("Message read:", data);
  // {
  //   messageId: '64f8b1234567890abcdef003',
  //   readBy: '64f8b1234567890abcdef456',
  //   readAt: '2024-01-15T15:05:00.000Z'
  // }
});
```

#### 7. Error Events

```javascript
socket.on("error", (data) => {
  console.error("Socket error:", data);
  // { message: 'Authentication failed' }
});
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
  "success": false,
  "error": "Validation failed",
  "details": "Participant ID is required"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "Not authorized to access this resource"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Chat room not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Testing with Postman

### 1. Import Collection

Create a new collection in Postman and add these requests:

### 2. Set Environment Variables

Create environment variables:

- `baseUrl`: `http://localhost:5000`
- `token`: Your JWT token
- `chatRoomId`: Chat room ID for testing
- `participantId`: Another user's ID for testing

### 3. Test Sequence

1. **Create Chat Room** → Save `chatRoomId` from response
2. **Get Chat Rooms** → Verify your chat appears
3. **Get Chat Messages** → Should return empty array initially
4. **Send Message** → Send a text message
5. **Get Chat Messages** → Should return your message
6. **Mark as Read** → Mark messages as read
7. **Get Chat Room Details** → Verify unread count is 0

### 4. Socket.io Testing

Use a WebSocket client or browser console:

```javascript
const socket = io("http://localhost:5000", {
  auth: {
    token: "your_jwt_token",
  },
});

socket.emit("authenticate");
socket.on("authenticated", console.log);
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Message IDs and Chat Room IDs are MongoDB ObjectIds
- Unread counts are automatically managed by the system
- Socket.io provides real-time features; REST API is for data fetching and fallback
- Authentication is required for all endpoints
- Message content validation depends on message type
