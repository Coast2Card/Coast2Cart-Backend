const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(err.accountNotVerified ? { accountNotVerified: true } : {}),
    ...(err.contactNo ? { contactNo: err.contactNo } : {}),
  });
};

module.exports = errorHandler;
