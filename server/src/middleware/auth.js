const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { ApiError, asyncHandler } = require('../utils/http');

const signToken = (user) => jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

/** Requires a valid "Authorization: Bearer <jwt>" header; loads req.user. */
const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token; // ?token= allows PDF downloads via link
  if (!token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Session expired – please log in again');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Your account has been suspended. Contact support.');
  req.user = user;
  next();
});

const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role)) return next(ApiError.forbidden(`This action is only available to ${roles.join(' / ')} accounts`));
  return next();
};

module.exports = { protect, requireRole, signToken };
