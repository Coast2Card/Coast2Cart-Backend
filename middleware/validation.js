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
 * Validation rules for buyer signup
 */
const validateBuyerSignup = [
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

module.exports = {
  validateBuyerSignup,
  checkUsernameUnique,
  checkEmailUnique,
  checkContactUnique,
  validateOTP,
  validateLogin,
  handleValidationErrors,
};
