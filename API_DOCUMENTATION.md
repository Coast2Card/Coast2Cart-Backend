# Coast2Cart Backend API Documentation

## Item Management API Routes

### Base URL

```
http://localhost:5000/api/items
```

---

## Public Routes (No Authentication Required)

### 1. Get All Items

**GET** `/api/items`

Get all active items with optional filtering and pagination.

**Query Parameters:**

- `itemType` (optional): Filter by item type (`fish`, `souvenirs`, `food`)
- `seller` (optional): Filter by seller ID
- `search` (optional): Search in item name and description
- `sortBy` (optional): Sort field (`catchDate`, `itemPrice`, `itemName`) - default: `catchDate`
- `sortOrder` (optional): Sort order (`asc`, `desc`) - default: `desc`
- `page` (optional): Page number - default: `1`
- `limit` (optional): Items per page - default: `20`

**Example Request:**

```
GET /api/items?itemType=fish&search=bangus&page=1&limit=10
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "item_id",
      "seller": {
        "_id": "seller_id",
        "firstName": "John",
        "lastName": "Doe",
        "username": "johndoe",
        "email": "john@example.com",
        "contactNo": "9123456789",
        "address": "Barangay Baybayon, Quezon"
      },
      "itemType": "fish",
      "itemName": "Bangus",
      "itemPrice": 289,
      "quantity": 10,
      "unit": "kg",
      "image": "https://res.cloudinary.com/dzjn8brwg/image/upload/v1641234567/coast2cart/items/image-1234567890.jpg",
      "imagePublicId": "coast2cart/items/image-1234567890",
      "description": "Fresh bangus from local fishermen",
      "location": "Barangay Baybayon, Quezon",
      "isActive": true,
      "catchDate": "2025-01-27T10:30:00.000Z",
      "formattedPrice": "₱289.00",
      "formattedQuantity": "10 kg",
      "isFresh": "Very Fresh",
      "createdAt": "2025-01-27T10:30:00.000Z",
      "updatedAt": "2025-01-27T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10
  }
}
```

### 2. Get Single Item

**GET** `/api/items/:itemId`

Get a specific item by its ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "item_id",
    "seller": {
      /* seller object */
    },
    "itemType": "fish",
    "itemName": "Bangus",
    "itemPrice": 289,
    "quantity": 10,
    "unit": "kg",
    "image": "https://res.cloudinary.com/dzjn8brwg/image/upload/v1641234567/coast2cart/items/image-1234567890.jpg",
    "imagePublicId": "coast2cart/items/image-1234567890",
    "description": "Fresh bangus from local fishermen",
    "location": "Barangay Baybayon, Quezon",
    "isActive": true,
    "catchDate": "2025-01-27T10:30:00.000Z",
    "formattedPrice": "₱289.00",
    "formattedQuantity": "10 kg",
    "isFresh": "Very Fresh",
    "createdAt": "2025-01-27T10:30:00.000Z",
    "updatedAt": "2025-01-27T10:30:00.000Z"
  }
}
```

### 3. Get Items by Seller

**GET** `/api/items/seller/:sellerId`

Get all items (active and inactive) by a specific seller.

**Query Parameters:**

- `isActive` (optional): Filter by active status (`true`, `false`)
- `itemType` (optional): Filter by item type
- `page` (optional): Page number
- `limit` (optional): Items per page

---

## Protected Routes (Authentication Required)

### 4. Create New Item

**POST** `/api/items`

Create a new item listing. Requires seller authentication.

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Body (Form Data):**

- `itemType` (required): Item type (`fish`, `souvenirs`, `food`)
- `itemName` (required): Item name (2-100 characters)
- `itemPrice` (required): Item price (positive number)
- `quantity` (required): Available quantity (non-negative number)
- `unit` (required): Unit of measurement (`kg`, `pieces`, `lbs`, `grams`)
- `image` (required): Item image file
- `description` (optional): Item description (max 500 characters)
- `location` (optional): Catch/source location (max 100 characters)

**Example Request:**

```javascript
const formData = new FormData();
formData.append("itemType", "fish");
formData.append("itemName", "Bangus");
formData.append("itemPrice", "289");
formData.append("quantity", "10");
formData.append("unit", "kg");
formData.append("image", imageFile);
formData.append("description", "Fresh bangus from local fishermen");
formData.append("location", "Barangay Baybayon, Quezon");

fetch("/api/items", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + token,
  },
  body: formData,
});
```

**Response:**

```json
{
  "success": true,
  "message": "Item created successfully",
  "data": {
    "_id": "new_item_id",
    "seller": "seller_id",
    "itemType": "fish",
    "itemName": "Bangus",
    "itemPrice": 289,
    "quantity": 10,
    "unit": "kg",
    "image": "https://res.cloudinary.com/dzjn8brwg/image/upload/v1641234567/coast2cart/items/image-1234567890.jpg",
    "imagePublicId": "coast2cart/items/image-1234567890",
    "description": "Fresh bangus from local fishermen",
    "location": "Barangay Baybayon, Quezon",
    "isActive": true,
    "catchDate": "2025-01-27T10:30:00.000Z",
    "createdAt": "2025-01-27T10:30:00.000Z",
    "updatedAt": "2025-01-27T10:30:00.000Z"
  }
}
```

### 5. Update Item

**PUT** `/api/items/:itemId`

Update an existing item. Only the item owner can update.

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Body (Form Data):**

- All fields from create item (all optional for updates)
- `image` (optional): New image file

### 6. Delete Item

**DELETE** `/api/items/:itemId`

Soft delete an item (sets isActive to false). Only the item owner can delete.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Item deleted successfully"
}
```

### 7. Sell Item

**POST** `/api/items/:itemId/sell`

Mark an item as sold and create a sold item record.

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**

```json
{
  "quantitySold": 2.5,
  "buyerId": "buyer_id",
  "notes": "Sold to regular customer"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Item sold successfully",
  "data": {
    "_id": "sold_item_id",
    "item": "original_item_id",
    "seller": {
      "_id": "seller_id",
      "firstName": "John",
      "lastName": "Doe"
    },
    "buyer": {
      "_id": "buyer_id",
      "firstName": "Jane",
      "lastName": "Smith"
    },
    "itemType": "fish",
    "itemName": "Bangus",
    "itemPrice": 289,
    "quantitySold": 2.5,
    "unit": "kg",
    "totalAmount": 722.5,
    "image": "https://res.cloudinary.com/dzjn8brwg/image/upload/v1641234567/coast2cart/items/image-1234567890.jpg",
    "imagePublicId": "coast2cart/items/image-1234567890",
    "saleDate": "2025-01-27T10:30:00.000Z",
    "status": "completed",
    "notes": "Sold to regular customer",
    "formattedPrice": "₱289.00",
    "formattedTotalAmount": "₱722.50",
    "formattedQuantity": "2.5 kg",
    "timeSinceSale": "2 hrs ago",
    "createdAt": "2025-01-27T10:30:00.000Z",
    "updatedAt": "2025-01-27T10:30:00.000Z"
  }
}
```

### 8. Get Sold Items by Seller

**GET** `/api/items/sold/seller/:sellerId`

Get all items sold by a specific seller.

**Query Parameters:**

- `itemType` (optional): Filter by item type
- `page` (optional): Page number
- `limit` (optional): Items per page

### 9. Get Sold Items by Buyer

**GET** `/api/items/sold/buyer/:buyerId`

Get all items purchased by a specific buyer.

**Query Parameters:**

- `itemType` (optional): Filter by item type
- `page` (optional): Page number
- `limit` (optional): Items per page

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400
}
```

**Common Status Codes:**

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

---

## Item Types and Units

**Item Types:**

- `fish`: Fresh seafood and fish
- `souvenirs`: Hand-crafted items and local products
- `food`: Processed food items

**Units:**

- `kg`: Kilograms (for fish and bulk items)
- `pieces`: Individual items (for souvenirs)
- `lbs`: Pounds (alternative weight unit)
- `grams`: Grams (for small quantities)

---

## Freshness Indicators (Fish Items Only)

The API automatically calculates freshness indicators for fish items:

- **Very Fresh**: Caught within 24 hours
- **Fresh**: Caught within 48 hours
- **Good**: Caught within 72 hours
- **Check Freshness**: Caught more than 72 hours ago

---

## Image Upload

- Maximum file size: 10MB
- Allowed formats: All image types (JPEG, PNG, GIF, etc.)
- Images are uploaded to Cloudinary cloud storage
- Images are automatically optimized and resized
- Access images via Cloudinary URLs (returned in API responses)
- Images are organized in `coast2cart/items/` folder on Cloudinary
