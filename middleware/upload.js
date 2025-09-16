const multer = require("multer");
const path = require("path");

// Configure storage - using memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (increased for Cloudinary)
  },
  fileFilter: fileFilter,
});

// Middleware for single image upload
const uploadSingle = upload.single("image");

// Middleware for multiple images upload (for future use)
const uploadMultiple = upload.array("images", 5); // Max 5 images

module.exports = {
  uploadSingle,
  uploadMultiple,
};
