const crypto = require('crypto');
const { User } = require('../models');
const { signToken } = require('../middleware/auth');
const { ApiError, ok, created, asyncHandler } = require('../utils/http');
const social = require('../services/socialAuthService');
const notifications = require('../services/notificationService');
const env = require('../config/env');

const session = (user) => ({ token: signToken(user), user: user.toJSON() });

exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role, vehicle, licenseNumber } = req.body;
  const exists = await User.findOne({ $or: [{ email }, { phone }] }).select('email phone');
  if (exists) throw ApiError.conflict(exists.email === email ? 'An account with this email already exists' : 'An account with this phone number already exists');

  const user = await User.create({
    name, email, phone, password, role,
    walletBalance: role === 'rider' ? 200 : 0, // welcome credit
    ...(role === 'driver' && { driver: { vehicle, licenseNumber, isOnline: false } }),
  });
  await notifications.notify(user._id, {
    type: 'system',
    title: `Welcome to CabConnect, ${user.name.split(' ')[0]}!`,
    body: role === 'rider' ? '₹200 welcome credit has been added to your wallet. Try code WELCOME50 on your first ride.' : 'Go online from your dashboard to start receiving ride requests.',
  });
  created(res, session(user));
});

exports.login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const query = identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: identifier };
  const user = await User.findOne(query).select('+password');
  // Same message for unknown user & bad password to avoid account enumeration.
  if (!user || !(await user.comparePassword(password))) throw ApiError.unauthorized('Invalid email/phone or password');
  if (!user.isActive) throw ApiError.forbidden('Your account has been suspended. Contact support.');
  ok(res, session(user));
});

exports.social = asyncHandler(async (req, res) => {
  const { provider, idToken, role } = req.body;
  const profile = await social.verify(provider, idToken);
  let user = await User.findOne({ email: profile.email });
  let isNew = false;
  if (!user) {
    if (role === 'driver') throw ApiError.badRequest('Drivers must register with vehicle details. Use the sign-up form.');
    user = await User.create({
      name: profile.name, email: profile.email, avatarUrl: profile.picture, role: 'rider', socialProvider: provider,
      password: crypto.randomBytes(24).toString('hex'), walletBalance: 200,
    });
    isNew = true;
  }
  if (!user.isActive) throw ApiError.forbidden('Your account has been suspended. Contact support.');
  ok(res, { ...session(user), isNew, mock: env.socialAuthProvider === 'mock' });
});

exports.me = asyncHandler(async (req, res) => ok(res, req.user.toJSON()));

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  user.password = req.body.newPassword;
  await user.save();
  ok(res, { changed: true });
});

exports.config = (_req, res) => ok(res, {
  socialAuthProvider: env.socialAuthProvider,
  paymentProvider: env.paymentProvider,
  mapsProvider: env.mapsProvider,
  emailProvider: env.emailProvider,
  smsProvider: env.smsProvider,
  currency: env.currency,
  cancellationFee: env.cancellationFee,
  cancellationFreeWindowMin: env.cancellationFreeWindowMin,
});
