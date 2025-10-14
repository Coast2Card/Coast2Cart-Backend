const Review = require("../models/Review");
const Account = require("../models/Accounts");
const { BadRequestError, NotFoundError } = require("../errors");
const { StatusCodes } = require("http-status-codes");


const createSellerReview = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const { stars, reviewText } = req.body;

    if (stars === undefined || stars === null) {
      return next(new BadRequestError("Missing required field: stars"));
    }

    // Validate seller exists and is a seller
    const seller = await Account.findById(sellerId);
    if (!seller) {
      return next(new NotFoundError("Seller not found"));
    }
    if (seller.role !== "seller") {
      return next(new BadRequestError("Reviews can only be created for sellers"));
    }

    const numericStars = Number(stars);
    if (!Number.isInteger(numericStars) || numericStars < 1 || numericStars > 5) {
      return next(new BadRequestError("Stars must be an integer between 1 and 5"));
    }

    const review = new Review({
      buyer: req.user?._id,
      stars: numericStars,
      reviewText,
      seller: sellerId,
    });

    await review.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Review created successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

const listSellerReviews = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const { page = 1, limit = 20, sortOrder = "desc" } = req.query;

    // Ensure seller exists
    const seller = await Account.findById(sellerId);
    if (!seller) {
      return next(new NotFoundError("Seller not found"));
    }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const sort = { createdAt: sortOrder === "desc" ? -1 : 1 };

    const [reviews, total] = await Promise.all([
      Review.find({ seller: sellerId })
        .sort(sort)
        .skip(skip)
        .limit(parsedLimit)
        .select("buyer stars reviewText createdAt")
        .populate({ path: "buyer", select: "username" }),
      Review.countDocuments({ seller: sellerId }),
    ]);

    const simplifiedReviews = reviews.map((r) => ({
      _id: r._id,
      buyer: r.buyer && typeof r.buyer === "object" ? r.buyer.username : r.buyer,
      stars: r.stars,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: simplifiedReviews,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / parsedLimit),
        totalItems: total,
        itemsPerPage: parsedLimit,
      },
    });
  } catch (error) {
    next(error);
  }
};

const listBuyerReviews = async (req, res, next) => {
  try {
    const { buyerId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Ensure buyer exists
    const buyer = await Account.findById(buyerId);
    if (!buyer) {
      return next(new NotFoundError("Buyer not found"));
    }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const sort = { createdAt: -1 }; // newest first

    const [reviews, total] = await Promise.all([
      Review.find({ buyer: buyerId })
        .sort(sort)
        .skip(skip)
        .limit(parsedLimit)
        .select("seller stars reviewText createdAt")
        .populate({ path: "seller", select: "username" }),
      Review.countDocuments({ buyer: buyerId }),
    ]);

    const simplifiedReviews = reviews.map((r) => ({
      _id: r._id,
      seller: r.seller && typeof r.seller === "object" ? r.seller.username : r.seller,
      stars: r.stars,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: simplifiedReviews,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / parsedLimit),
        totalItems: total,
        itemsPerPage: parsedLimit,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSellerReview,
  listSellerReviews,
  listBuyerReviews,
};


