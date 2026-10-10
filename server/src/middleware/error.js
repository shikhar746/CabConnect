const mongoose = require('mongoose');
const multer = require('multer');
const { ApiError } = require('../utils/http');
const logger = require('../utils/logger');
const env = require('../config/env');

const notFound = (req, _res, next) => next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let { details } = err;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0]?.message || 'Validation failed';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `An account with this ${field} already exists`;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 2 MB)' : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) logger.error(err.stack || err);
  res.status(status).json({
    success: false,
    error: { message: status >= 500 && env.isProd ? 'Internal server error' : message, ...(details && { details }) },
  });
}

module.exports = { notFound, errorHandler, ApiError };
