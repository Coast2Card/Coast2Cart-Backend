const cloudinary = require("../config/cloudinary");
const { BadRequestError } = require("../errors");

/**
 * Upload image to Cloudinary
 * @param {Object} file - The file object from multer
 * @param {string} folder - The folder in Cloudinary to upload to
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (file, folder = "coast2cart/items") => {
  try {
    if (!file) {
      throw new BadRequestError("No file provided for upload");
    }

    // Convert buffer to base64 string for Cloudinary upload
    const base64String = `data:${file.mimetype};base64,${file.buffer.toString(
      "base64"
    )}`;

    // Upload to Cloudinary using base64 string
    const result = await cloudinary.uploader.upload(base64String, {
      folder: folder,
      resource_type: "auto", // Automatically detect image/video
      quality: "auto", // Automatic quality optimization
      fetch_format: "auto", // Automatic format optimization
      transformation: [
        {
          width: 800,
          height: 600,
          crop: "limit", // Maintain aspect ratio, limit dimensions
          quality: "auto",
        },
      ],
    });

    return result;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new BadRequestError(`Image upload failed: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - The public ID of the image to delete
 * @returns {Promise<Object>} - Cloudinary deletion result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new BadRequestError("No public ID provided for deletion");
    }

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    throw new BadRequestError(`Image deletion failed: ${error.message}`);
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} - Public ID
 */
const extractPublicId = (url) => {
  try {
    if (!url) return null;

    // Extract public ID from Cloudinary URL
    // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
    const parts = url.split("/");
    const uploadIndex = parts.findIndex((part) => part === "upload");

    if (uploadIndex === -1) return null;

    // Get everything after "upload" and before the file extension
    const pathParts = parts.slice(uploadIndex + 2); // Skip "upload" and version
    const publicId = pathParts.join("/").split(".")[0]; // Remove file extension

    return publicId;
  } catch (error) {
    console.error("Error extracting public ID:", error);
    return null;
  }
};

/**
 * Generate optimized image URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Transformation options
 * @returns {string} - Optimized image URL
 */
const getOptimizedImageUrl = (publicId, options = {}) => {
  try {
    if (!publicId) return null;

    const {
      width = 400,
      height = 300,
      crop = "limit",
      quality = "auto",
      format = "auto",
    } = options;

    return cloudinary.url(publicId, {
      width,
      height,
      crop,
      quality,
      format,
    });
  } catch (error) {
    console.error("Error generating optimized URL:", error);
    return null;
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
  getOptimizedImageUrl,
};
