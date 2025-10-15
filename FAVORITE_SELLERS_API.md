# Favorite Sellers API

## GET /api/items/favorite-sellers/:buyerId

Retrieves the favorite sellers for a specific buyer based on their purchase history.

### Description
This endpoint returns sellers that the buyer has purchased from, along with:
- Total count of purchases from each seller
- Seller's name and profile picture
- Average rating based on all reviews received by the seller (not just from this buyer)
- Total amount spent with each seller
- Last purchase date

### Parameters

#### Path Parameters
- `buyerId` (string, required): The ID of the buyer

#### Query Parameters
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of sellers per page (default: 10, max: 100)
- `search` (string, optional): Search term to filter sellers by name or username
- `sortBy` (string, optional): Field to sort by (default: "purchaseCount")
  - `purchaseCount`: Sort by number of purchases
  - `averageRating`: Sort by seller's average rating
  - `sellerName`: Sort by seller's name alphabetically
- `sortOrder` (string, optional): Sort order (default: "desc")
  - `asc`: Ascending order
  - `desc`: Descending order

### Response Format

```json
{
  "success": true,
  "data": [
    {
      "_id": "seller_id",
      "sellerId": "seller_id",
      "sellerName": "John Doe",
      "username": "johndoe",
      "profilePicture": "https://cloudinary-url/profile.jpg",
      "purchaseCount": 5,
      "totalSpent": 1250.00,
      "averageRating": 4.2,
      "totalReviews": 15,
      "lastPurchaseDate": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalSellers": 25,
    "sellersPerPage": 10
  },
  "search": null,
  "sortBy": "purchaseCount",
  "sortOrder": "desc"
}
```

### Example Requests

#### Basic Request
```
GET /api/items/favorite-sellers/64a1b2c3d4e5f6789012345
```

#### With Pagination
```
GET /api/items/favorite-sellers/64a1b2c3d4e5f6789012345?page=2&limit=5
```

#### With Search
```
GET /api/items/favorite-sellers/64a1b2c3d4e5f6789012345?search=john
```

#### With Sorting
```
GET /api/items/favorite-sellers/64a1b2c3d4e5f6789012345?sortBy=averageRating&sortOrder=desc
```

#### Combined Parameters
```
GET /api/items/favorite-sellers/64a1b2c3d4e5f6789012345?page=1&limit=10&search=alice&sortBy=purchaseCount&sortOrder=desc
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Buyer ID is required"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Buyer not found"
}
```

### Notes
- The average rating is calculated from ALL reviews received by the seller, not just reviews from the requesting buyer
- Sellers are only included if the buyer has made at least one purchase from them
- The endpoint returns sellers sorted by purchase count (descending) by default
- Search functionality works on seller's first name, last name, and username
- Pagination is supported for large result sets
