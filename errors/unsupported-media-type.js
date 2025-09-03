const { StatusCodes } = require("http-status-codes");
const CustomAPIError = require("./custom-api");

class UnsupportedMediaTypeError extends CustomAPIError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.UNSUPPORTED_MEDIA_TYPE;
  }
}

module.exports = UnsupportedMediaTypeError;
