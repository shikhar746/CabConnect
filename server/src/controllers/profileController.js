const fs = require('fs/promises');
const path = require('path');
const { User } = require('../models');
const { ApiError, ok, created, asyncHandler } = require('../utils/http');
const gateway = require('../services/payment');
const paymentService = require('../services/paymentService');
const { UPLOAD_DIR } = require('../middleware/upload');

exports.update = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (phone && phone !== req.user.phone && (await User.exists({ phone, _id: { $ne: req.user._id } }))) {
    throw ApiError.conflict('This phone number is already in use');
  }
  if (name) req.user.name = name;
  if (phone) req.user.phone = phone;
  await req.user.save();
  ok(res, req.user.toJSON());
});

exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload');
  const old = req.user.avatarUrl;
  req.user.avatarUrl = `/uploads/${req.file.filename}`;
  await req.user.save();
  if (old?.startsWith('/uploads/')) await fs.unlink(path.join(UPLOAD_DIR, path.basename(old))).catch(() => {});
  ok(res, req.user.toJSON());
});

exports.removeAvatar = asyncHandler(async (req, res) => {
  const old = req.user.avatarUrl;
  req.user.avatarUrl = undefined;
  await req.user.save();
  if (old?.startsWith('/uploads/')) await fs.unlink(path.join(UPLOAD_DIR, path.basename(old))).catch(() => {});
  ok(res, req.user.toJSON());
});

exports.updateVehicle = asyncHandler(async (req, res) => {
  if (req.user.role !== 'driver') throw ApiError.forbidden();
  if (req.user.driver.isBusy) throw ApiError.conflict('You cannot change vehicles during a ride');
  req.user.driver.vehicle = req.body.vehicle;
  if (req.body.licenseNumber) req.user.driver.licenseNumber = req.body.licenseNumber;
  await req.user.save();
  ok(res, req.user.toJSON());
});

exports.addPaymentMethod = asyncHandler(async (req, res) => {
  const body = req.body;
  if (req.user.paymentMethods.length >= 6) throw ApiError.badRequest('You can save up to 6 payment methods');
  let entry;
  if (body.type === 'card') {
    const tok = await gateway.tokenizeCard(body);
    entry = { type: 'card', label: body.label || `${tok.brand.toUpperCase()} •••• ${tok.last4}`, brand: tok.brand, last4: tok.last4, expMonth: tok.expMonth, expYear: tok.expYear, providerToken: tok.providerToken };
  } else {
    if (req.user.paymentMethods.some((p) => p.upiId === body.upiId)) throw ApiError.conflict('This UPI ID is already saved');
    entry = { type: 'upi', label: body.label || body.upiId, upiId: body.upiId };
  }
  const makeDefault = body.isDefault || req.user.paymentMethods.length === 0;
  if (makeDefault) req.user.paymentMethods.forEach((p) => { p.isDefault = false; });
  req.user.paymentMethods.push({ ...entry, isDefault: makeDefault });
  await req.user.save();
  created(res, req.user.toJSON().paymentMethods);
});

exports.removePaymentMethod = asyncHandler(async (req, res) => {
  const pm = req.user.paymentMethods.id(req.params.pmId);
  if (!pm) throw ApiError.notFound('Payment method not found');
  const wasDefault = pm.isDefault;
  pm.deleteOne();
  if (wasDefault && req.user.paymentMethods[0]) req.user.paymentMethods[0].isDefault = true;
  await req.user.save();
  ok(res, req.user.toJSON().paymentMethods);
});

exports.setDefaultPaymentMethod = asyncHandler(async (req, res) => {
  const pm = req.user.paymentMethods.id(req.params.pmId);
  if (!pm) throw ApiError.notFound('Payment method not found');
  req.user.paymentMethods.forEach((p) => { p.isDefault = String(p._id) === String(pm._id); });
  await req.user.save();
  ok(res, req.user.toJSON().paymentMethods);
});

exports.addContact = asyncHandler(async (req, res) => {
  if (req.user.emergencyContacts.length >= 5) throw ApiError.badRequest('You can add up to 5 emergency contacts');
  req.user.emergencyContacts.push(req.body);
  await req.user.save();
  created(res, req.user.emergencyContacts);
});

exports.removeContact = asyncHandler(async (req, res) => {
  const c = req.user.emergencyContacts.id(req.params.contactId);
  if (!c) throw ApiError.notFound('Contact not found');
  c.deleteOne();
  await req.user.save();
  ok(res, req.user.emergencyContacts);
});

exports.topUpWallet = asyncHandler(async (req, res) => ok(res, await paymentService.topUpWallet(req.user, req.body)));
