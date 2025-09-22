const { body, validationResult } = require("express-validator");
const Account = require("../models/Accounts");
const { BadRequestError } = require("../errors");

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    return next(new BadRequestError(errorMessages.join(", ")));
  }
  next();
};

/**
 * Validation rules for unified signup (buyers and sellers)
 */
const validateSignup = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("dateOfBirth")
    .isISO8601()
    .withMessage("Please provide a valid date of birth")
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      if (age < 18) {
        throw new Error("You must be at least 18 years old to register");
      }
      return true;
    }),

  body("contactNo")
    .trim()
    .notEmpty()
    .withMessage("Contact number is required")
    .matches(/^9\d{9}$/)
    .withMessage(
      "Please provide a valid Philippine phone number starting with 9 (e.g., 9123456789)"
    ),

  body("address")
    .trim()
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ min: 10, max: 200 })
    .withMessage("Address must be between 10 and 200 characters"),

  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Password confirmation does not match password");
    }
    return true;
  }),

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["buyer", "seller"])
    .withMessage("Role must be either 'buyer' or 'seller'"),

  handleValidationErrors,
];


/**
 * Check if username is unique
 */
const checkUsernameUnique = async (req, res, next) => {
  try {
    const { username } = req.body;
    const existingUser = await Account.findOne({
      username: username.toLowerCase(),
    });

    if (existingUser) {
      return next(new BadRequestError("Username already exists"));
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if email is unique
 */
const checkEmailUnique = async (req, res, next) => {
  try {
    const { email } = req.body;
    const existingUser = await Account.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return next(new BadRequestError("Email already exists"));
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if contact number is unique
 */
const checkContactUnique = async (req, res, next) => {
  try {
    const { contactNo } = req.body;
    const existingUser = await Account.findOne({ contactNo });

    if (existingUser) {
      return next(new BadRequestError("Contact number already exists"));
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validation rules for OTP verification
 */
const validateOTP = [
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),

  body("contactNo")
    .trim()
    .notEmpty()
    .withMessage("Contact number is required")
    .matches(/^9\d{9}$/)
    .withMessage(
      "Please provide a valid Philippine phone number starting with 9 (e.g., 9123456789)"
    ),

  handleValidationErrors,
];

/**
 * Validation rules for login
 */
const validateLogin = [
  body("identifier")
    .trim()
    .notEmpty()
    .withMessage("Username, email, or contact number is required"),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

/**
 * Validation rules for item creation
 */
const validateItemCreation = [
  body("itemType")
    .trim()
    .notEmpty()
    .withMessage("Item type is required")
    .isIn(["fish", "souvenirs", "food"])
    .withMessage("Item type must be 'fish', 'souvenirs', or 'food'"),

  body("itemName")
    .trim()
    .notEmpty()
    .withMessage("Item name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Item name must be between 2 and 100 characters"),

  body("itemPrice")
    .isFloat({ min: 0.01 })
    .withMessage("Item price must be a positive number greater than 0"),

  body("quantity")
    .isFloat({ min: 0 })
    .withMessage("Quantity must be a non-negative number"),

  body("unit")
    .trim()
    .notEmpty()
    .withMessage("Unit is required")
    .isIn(["kg", "pieces", "lbs", "grams"])
    .withMessage("Unit must be 'kg', 'pieces', 'lbs', or 'grams'"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters"),

  handleValidationErrors,
];

/**
 * Validation rules for item update
 */
const validateItemUpdate = [
  body("itemType")
    .optional()
    .trim()
    .isIn(["fish", "souvenirs", "food"])
    .withMessage("Item type must be 'fish', 'souvenirs', or 'food'"),

  body("itemName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Item name must be between 2 and 100 characters"),

  body("itemPrice")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Item price must be a positive number greater than 0"),

  body("quantity")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Quantity must be a non-negative number"),

  body("unit")
    .optional()
    .trim()
    .isIn(["kg", "pieces", "lbs", "grams"])
    .withMessage("Unit must be 'kg', 'pieces', 'lbs', or 'grams'"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters"),

  handleValidationErrors,
];

/**
 * Validation rules for selling an item
 */
const validateSellItem = [
  body("quantitySold")
    .isFloat({ min: 0.01 })
    .withMessage("Quantity sold must be a positive number greater than 0"),

  body("buyerId").isMongoId().withMessage("Valid buyer ID is required"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Notes cannot exceed 200 characters"),

  handleValidationErrors,
];

/**
 * Validation rules for profile updates
 */
const validateProfileUpdate = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date of birth")
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      if (age < 18) {
        throw new Error("You must be at least 18 years old");
      }
      return true;
    }),

  body("contactNo")
    .optional()
    .trim()
    .matches(/^9\d{9}$/)
    .withMessage(
      "Please provide a valid Philippine phone number starting with 9 (e.g., 9123456789)"
    ),

  body("address")
    .optional()
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage("Address must be between 10 and 200 characters"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  handleValidationErrors,
];

module.exports = {
  validateSignup, // Unified signup validation
  checkUsernameUnique,
  checkEmailUnique,
  checkContactUnique,
  validateOTP,
  validateLogin,
  validateItemCreation,
  validateItemUpdate,
  validateSellItem,
  validateProfileUpdate,
  handleValidationErrors,
};
