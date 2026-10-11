const express = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { avatarUpload } = require('../middleware/upload');
const S = require('../validators/schemas');
const { ApiError } = require('../utils/http');

const auth = require('../controllers/authController');
const profile = require('../controllers/profileController');
const rides = require('../controllers/rideController');
const driver = require('../controllers/driverController');
const misc = require('../controllers/miscController');
const support = require('../controllers/supportController');
const admin = require('../controllers/adminController');

const router = express.Router();

// Rejects malformed :id params before they hit the database.
router.param('id', (_req, _res, next, id) => (/^[a-f0-9]{24}$/i.test(id) ? next() : next(ApiError.badRequest('Invalid id'))));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 1000 : env.authRateLimit, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { message: 'Too many attempts. Please try again in a few minutes.' } } });

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }));
router.get('/config', auth.config);

// ---- Auth ----
router.post('/auth/register', authLimiter, validate(S.auth.register), auth.register);
router.post('/auth/login', authLimiter, validate(S.auth.login), auth.login);
router.post('/auth/social', authLimiter, validate(S.auth.social), auth.social);
router.get('/auth/me', protect, auth.me);
router.post('/auth/change-password', protect, validate(S.auth.changePassword), auth.changePassword);

// ---- Profile ----
router.patch('/users/me', protect, validate(S.profile.update), profile.update);
router.post('/users/me/avatar', protect, avatarUpload, profile.uploadAvatar);
router.delete('/users/me/avatar', protect, profile.removeAvatar);
router.put('/users/me/vehicle', protect, requireRole('driver'), validate(S.profile.vehicle), profile.updateVehicle);
router.post('/users/me/payment-methods', protect, requireRole('rider'), validate(S.profile.paymentMethod), profile.addPaymentMethod);
router.delete('/users/me/payment-methods/:pmId', protect, requireRole('rider'), profile.removePaymentMethod);
router.patch('/users/me/payment-methods/:pmId/default', protect, requireRole('rider'), profile.setDefaultPaymentMethod);
router.post('/users/me/emergency-contacts', protect, validate(S.profile.contact), profile.addContact);
router.delete('/users/me/emergency-contacts/:contactId', protect, profile.removeContact);
router.post('/users/me/wallet/top-up', protect, requireRole('rider'), validate(S.profile.topUp), profile.topUpWallet);

// ---- Maps ----
router.get('/maps/search', protect, misc.searchPlaces);
router.get('/maps/reverse', protect, misc.reverseGeocode);

// ---- Rides ----
router.get('/rides/types', rides.rideTypes);
router.post('/rides/estimate', protect, requireRole('rider'), validate(S.ride.estimate), rides.estimate);
router.post('/rides', protect, requireRole('rider'), validate(S.ride.create), rides.create);
router.get('/rides', protect, requireRole('rider', 'driver'), validate(S.ride.list, 'query'), rides.list);
router.get('/rides/active', protect, rides.active);
router.get('/rides/:id', protect, rides.get);
router.post('/rides/:id/cancel', protect, requireRole('rider', 'driver'), validate(S.ride.cancel), rides.cancel);
router.post('/rides/:id/pay', protect, requireRole('rider'), validate(S.ride.pay), rides.pay);
router.post('/rides/:id/review', protect, requireRole('rider'), validate(S.ride.review), rides.review);
router.post('/rides/:id/sos', protect, requireRole('rider', 'driver'), validate(S.ride.sos), rides.sos);
router.get('/rides/:id/receipt', protect, rides.receipt);
router.post('/rides/:id/receipt/email', protect, rides.emailReceipt);

// ---- Driver ----
const asDriver = [protect, requireRole('driver')];
router.patch('/driver/status', ...asDriver, validate(S.driver.status), driver.setStatus);
router.post('/driver/location', ...asDriver, validate(S.driver.location), driver.updateLocation);
router.get('/driver/requests', ...asDriver, driver.requests);
router.post('/driver/rides/:id/accept', ...asDriver, driver.accept);
router.post('/driver/rides/:id/decline', ...asDriver, driver.decline);
router.post('/driver/rides/:id/arrive', ...asDriver, driver.arrive);
router.post('/driver/rides/:id/start', ...asDriver, validate(S.ride.start), driver.start);
router.post('/driver/rides/:id/complete', ...asDriver, driver.complete);
router.get('/driver/earnings', ...asDriver, driver.earnings);
router.post('/driver/payouts', ...asDriver, driver.payout);
router.get('/driver/reviews', ...asDriver, driver.myReviews);
router.get('/drivers/:id', protect, driver.publicProfile);

// ---- Promos ----
router.get('/promos', protect, misc.activePromos);
router.post('/promos/validate', protect, validate(S.promo.validate), misc.validatePromo);

// ---- Notifications ----
router.get('/notifications', protect, misc.listNotifications);
router.patch('/notifications/read-all', protect, misc.markAllRead);
router.patch('/notifications/:id/read', protect, misc.markRead);

// ---- Support ----
router.post('/support/tickets', protect, requireRole('rider', 'driver'), validate(S.support.create), support.create);
router.get('/support/tickets', protect, support.list);
router.get('/support/tickets/:id', protect, support.get);
router.post('/support/tickets/:id/messages', protect, validate(S.support.message), support.addMessage);
router.patch('/support/tickets/:id', protect, requireRole('admin'), validate(S.support.update), support.update);

// ---- Admin ----
const asAdmin = [protect, requireRole('admin')];
router.get('/admin/stats', ...asAdmin, admin.stats);
router.get('/admin/users', ...asAdmin, admin.users);
router.patch('/admin/users/:id', ...asAdmin, validate(S.admin.userUpdate), admin.updateUser);
router.get('/admin/rides', ...asAdmin, admin.rides);
router.get('/admin/payments', ...asAdmin, admin.payments);
router.get('/admin/promos', ...asAdmin, admin.promos);
router.post('/admin/promos', ...asAdmin, validate(S.promo.upsert), admin.createPromo);
router.put('/admin/promos/:id', ...asAdmin, validate(S.promo.upsert), admin.updatePromo);
router.delete('/admin/promos/:id', ...asAdmin, admin.deletePromo);
router.get('/admin/sos', ...asAdmin, admin.sosList);
router.patch('/admin/sos/:id', ...asAdmin, validate(S.admin.sos), admin.resolveSos);
router.get('/admin/outbox', ...asAdmin, admin.outbox);

module.exports = router;
