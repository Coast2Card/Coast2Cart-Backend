const CustomAPIError = require("./custom-api");
const UnauthenticatedError = require("./unauthenticated");
const BadRequestError = require("./bad-request");
const UnauthorizedError = require("./unauthorized");
const ConflictError = require("./conflict");
const InternalServerError = require("./internal-server");
const NotFoundError = require("./not-found");
const PayloadTooLargeError = require("./payload-too-large");
const TooManyRequestsError = require("./too-many-requests");
const UnprocessableEntityError = require("./unprocessable-entity");
const UnsupportedMediaTypeError = require("./unsupported-media-type");

module.exports = {
  CustomAPIError,
  UnauthenticatedError,
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  PayloadTooLargeError,
  TooManyRequestsError,
  UnprocessableEntityError,
  UnsupportedMediaTypeError,
};
