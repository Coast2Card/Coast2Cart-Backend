const express = require("express");
const router = express.Router();

const Account = require("../models/Accounts");
const { BadRequestError, ConflictError } = require("../errors");

// POST /api/test/create-account (create account directly, choose verified/unverified)
router.post("/create-account", async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      username,
      dateOfBirth,
      contactNo,
      address,
      email,
      password,
      role = "buyer",
      isVerified = true,
      status,
    } = req.body;

    if (!firstName || !lastName || !username || !dateOfBirth || !contactNo || !address || !email || !password) {
      throw new BadRequestError("Missing required fields");
    }

    const existing = await Account.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
        { contactNo },
      ],
    });
    if (existing) {
      throw new ConflictError("Account already exists with provided username/email/contactNo");
    }

    const account = await Account.create({
      firstName,
      lastName,
      username: username.toLowerCase(),
      dateOfBirth,
      contactNo,
      address,
      email: email.toLowerCase(),
      password,
      role,
      isVerified,
      status: role === "seller" ? (status || "pending_otp") : undefined,
    });

    res.status(201).json({
      success: true,
      message: "Test account created",
      data: {
        id: account._id,
        username: account.username,
        email: account.email,
        contactNo: account.contactNo,
        role: account.role,
        isVerified: account.isVerified,
        status: account.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


