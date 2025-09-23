const { BadRequestError } = require("../errors");

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const performChecks = (file) => {
  if (!file.mimetype || !file.mimetype.startsWith("image/")) {
    throw new BadRequestError("Only image files are allowed");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new BadRequestError("Image file size must be less than 10MB");
  }
};

// Requires an image
const validateMulterImage = (req, res, next) => {
  try {
    if (!req.file) {
      return next(new BadRequestError("Item image is required"));
    }
    performChecks(req.file);
    return next();
  } catch (err) {
    return next(err);
  }
};

// Validates only if an image is present
const validateMulterImageOptional = (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }
    performChecks(req.file);
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { validateMulterImage, validateMulterImageOptional };


