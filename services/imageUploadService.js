const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload a single image to cloudinary
const uploadImage = async (fileInput, options = {}) => {
  try {
    // Normalize input: accept multer file object, express-fileupload file object, or raw Buffer
    let buffer;
    let mimetype;

    if (fileInput && fileInput.buffer && fileInput.mimetype) {
      // Multer style { buffer, mimetype }
      buffer = fileInput.buffer;
      mimetype = fileInput.mimetype;
    } else if (fileInput && fileInput.data && fileInput.mimetype) {
      // express-fileupload style { data, mimetype }
      buffer = fileInput.data;
      mimetype = fileInput.mimetype;
    } else if (Buffer.isBuffer(fileInput)) {
      buffer = fileInput;
      mimetype = options.mimetype || "image/jpeg";
    } else {
      throw new Error("Invalid file input for uploadImage");
    }

    const base64Data = `data:${mimetype};base64,${buffer.toString("base64")}`;

    const defaultOptions = {
      folder: "coast2cart/items",
      resource_type: "auto",
      quality: "auto",
      fetch_format: "auto",
      transformation: [
        { width: 800, height: 600, crop: "limit", quality: "auto" },
      ],
      use_filename: true,
      unique_filename: false,
    };

    const uploadOptions = { ...defaultOptions, ...options };

    const response = await cloudinary.uploader.upload(base64Data, uploadOptions);

    return {
      url: response.secure_url,
      publicId: response.public_id,
      success: true,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
  }
};

// Upload multiple images to Cloudinary
const uploadMultipleImages = async (files, options = {}) => {
  try {
    const imageFiles = Array.isArray(files) ? files : [files];
    const urls = [];
    const publicIds = [];
    const errors = [];

    for (const file of imageFiles) {
      try {
        const result = await uploadImage(file, options);
        urls.push(result.url);
        publicIds.push(result.publicId);
      } catch (error) {
        console.error("Failed to upload individual file:", error);
        errors.push(error.message);
      }
    }

    if (errors.length === imageFiles.length) {
      throw new Error("All image uploads failed.");
    }

    return {
      urls,
      publicIds,
      success: true,
      partialFailures: errors.length > 0 ? errors : null,
    };
  } catch (error) {
    console.error("Multiple image upload error:", error);
    throw new Error(`Failed to upload images: ${error.message}`);
  }
};

// Upload a profile photo with optimizations
const uploadProfilePhoto = async (fileData, options = {}) => {
  const defaultOptions = {
    folder: "profile_photos",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto" },
      { format: "auto" },
    ],
    ...options,
  };

  return await uploadImage(fileData, defaultOptions);
};

// Upload report images
const uploadReportImages = async (files, options = {}) => {
  const defaultOptions = {
    folder: "reports",
    transformation: [{ quality: "auto" }, { format: "auto" }],
    ...options,
  };

  return await uploadMultipleImages(files, defaultOptions);
};

// Upload admin post images
const uploadAdminPostImages = async (files, options = {}) => {
  const defaultOptions = {
    folder: "admin_posts",
    transformation: [{ quality: "auto" }, { format: "auto" }],
    ...options,
  };

  return await uploadMultipleImages(files, defaultOptions);
};

// Delete an image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log("Image deleted:", result);
    return {
      success: result.result === "ok",
      result,
    };
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

// Delete multiple images from Cloudinary
const deleteMultipleImages = async (publicIds) => {
  try {
    const results = await Promise.allSettled(
      publicIds.map((publicId) => deleteImage(publicId))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return {
      successful,
      failed,
      total: publicIds.length,
      details: results,
    };
  } catch (error) {
    console.error("Multiple image deletion error:", error);
    throw new Error(`Failed to delete images: ${error.message}`);
  }
};

// Generate transformed image URL
const getTransformedUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, transformations);
};

module.exports = {
  uploadImage,
  uploadMultipleImages,
  uploadProfilePhoto,
  uploadReportImages,
  uploadAdminPostImages,
  deleteImage,
  deleteMultipleImages,
  getTransformedUrl,
};
