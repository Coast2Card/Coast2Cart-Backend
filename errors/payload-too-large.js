const { StatusCodes } = require("http-status-codes");
const CustomAPIError = require("./custom-api");

class PayloadTooLargeError extends CustomAPIError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.REQUEST_TOO_LONG;
  }
}

module.exports = PayloadTooLargeError;
