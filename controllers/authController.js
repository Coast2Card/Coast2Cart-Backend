const Account = require("../models/Accounts");
const {
  BadRequestError,
  UnauthenticatedError,
  UnauthorizedError,
  NotFoundError,
} = require("../errors");
const asyncErrorHandler = require("../middleware/asyncErrorHandler");

const register = asyncErrorHandler(async (req, res) => {
  const { email, role } = req.body;

  const existingAccount = await Account.findOne({ email });

  if (existingAccount) {
    throw new BadRequestError("Account with this email already exists.");
  }

  if (!role) {
    throw new BadRequestError("Account role is required.");
  }

  const account = await Account.create(req.body);

  res.status(201).json({
    message: "Account created successfully on the database.",
    email: account.email,
  });
});

const login = asyncErrorHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError(
      "Please provide both credentials for email and password."
    );
  }

  const account = await Account.findOne({ email });

  if (!account) {
    throw new NotFoundError("Account with inputted email does not exist.");
  }

  const isPasswordCorrect = await account.comparePassword(password);

  if (!isPasswordCorrect) {
    throw new UnauthenticatedError("Incorrect password inputted.");
  }

  res.status(200).json({
    success: true,
    message: "You are now logged in.",
  });

  console.log(
    `User of ${email} address has successfully logged in to the system.`
  );
});

module.exports = {
  register,
  login,
};
