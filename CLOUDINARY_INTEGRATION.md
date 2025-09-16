# Cloudinary Integration for Coast2Cart Backend

## Overview

The Coast2Cart backend now uses Cloudinary for image storage and management instead of local file storage. This provides better performance, automatic image optimization, and cloud-based storage.

## Configuration

### Environment Variables

The following environment variables are required in your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=dzjn8brwg
CLOUDINARY_API_KEY=542497747719967
CLOUDINARY_API_SECRET=9ARdFdhv_tSwbwGjSdJedWZZFKI
```

### Cloudinary Setup

1. **Cloud Configuration**: Located in `backend/config/cloudinary.js`
2. **Upload Middleware**: Located in `backend/middleware/cloudinaryUpload.js`
3. **Updated Models**: Both `Item` and `SoldItem` models now include `imagePublicId` field

## Key Features

### 1. Automatic Image Optimization

- Images are automatically resized to 800x600 with aspect ratio preservation
- Quality is automatically optimized
- Format is automatically converted for best performance

### 2. Organized Storage

- All item images are stored in `coast2cart/items/` folder
- Each image gets a unique public ID for easy management

### 3. Image Management Functions

- `uploadToCloudinary()`: Upload images to Cloudinary
- `deleteFromCloudinary()`: Delete images from Cloudinary
- `extractPublicId()`: Extract public ID from Cloudinary URL
- `getOptimizedImageUrl()`: Generate optimized image URLs

## Updated API Behavior

### Item Creation

```javascript
// Before (Local Storage)
{
  "image": "uploads/items/image-1234567890.jpg"
}

// After (Cloudinary)
{
  "image": "https://res.cloudinary.com/dzjn8brwg/image/upload/v1641234567/coast2cart/items/image-1234567890.jpg",
  "imagePublicId": "coast2cart/items/image-1234567890"
}
```

### Image Updates

- When updating an item's image, the old image is automatically deleted from Cloudinary
- New image is uploaded and the public ID is updated

### Item Deletion

- When deleting an item, the associated image is also deleted from Cloudinary

## File Upload Process

1. **Frontend**: User selects image file
2. **Multer**: Handles file upload (now using memory storage)
3. **Cloudinary**: Image is uploaded to cloud storage
4. **Database**: Cloudinary URL and public ID are stored
5. **Response**: Frontend receives Cloudinary URL for display

## Benefits

### Performance

- Images are served from Cloudinary's global CDN
- Automatic image optimization reduces file sizes
- Faster loading times for users

### Scalability

- No local storage limitations
- Automatic backup and redundancy
- Easy to scale with growing user base

### Management

- Easy image deletion and updates
- Organized folder structure
- Public ID tracking for efficient management

## Testing

Run the Cloudinary integration tests:

```bash
cd backend
node test/cloudinaryTest.js
```

This will test:

- Cloudinary configuration
- Public ID extraction
- Optimized URL generation

## Error Handling

The integration includes comprehensive error handling:

- Upload failures are caught and reported
- Image deletion failures don't prevent item operations
- Graceful fallbacks for missing images

## Migration Notes

### For Existing Data

If you have existing items with local image paths, you'll need to:

1. Upload existing images to Cloudinary
2. Update the database records with new Cloudinary URLs and public IDs

### For New Deployments

- No migration needed
- All new images will automatically use Cloudinary

## Security

- API keys are stored securely in environment variables
- Images are organized in private folders
- Public IDs are not easily guessable
- Access control through Cloudinary's security features

## Cost Considerations

- Cloudinary offers a free tier with generous limits
- Pay-per-use pricing for higher volumes
- Automatic optimization reduces bandwidth costs
- No local storage costs

## Monitoring

Monitor your Cloudinary usage through:

- Cloudinary Dashboard
- API response logs
- Error handling in application logs

## Support

For issues with Cloudinary integration:

1. Check environment variables
2. Verify Cloudinary account status
3. Review error logs
4. Test with the provided test file
