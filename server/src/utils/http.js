class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Authentication required') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to do this') { return new ApiError(403, msg); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg); }
  static conflict(msg) { return new ApiError(409, msg); }
}

/** Uniform success envelope: { success, data, meta? } */
const ok = (res, data, meta, status = 200) =>
  res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });

const created = (res, data) => ok(res, data, undefined, 201);

/** Wraps async route handlers so rejections reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Parses ?page & ?limit into safe values. */
const paginate = (query, defaults = { limit: 10, max: 50 }) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(defaults.max, Math.max(1, parseInt(query.limit, 10) || defaults.limit));
  return { page, limit, skip: (page - 1) * limit };
};

const pageMeta = (total, { page, limit }) => ({ total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { ApiError, ok, created, asyncHandler, paginate, pageMeta, escapeRegex };
