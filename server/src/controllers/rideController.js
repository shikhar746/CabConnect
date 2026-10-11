const { Ride } = require('../models');
const { ACTIVE_RIDE_STATUS, RIDE_TYPES } = require('../config/constants');
const { ApiError, ok, created, asyncHandler, pageMeta } = require('../utils/http');
const fareService = require('../services/fareService');
const rideService = require('../services/rideService');
const paymentService = require('../services/paymentService');
const reviewService = require('../services/reviewService');
const sosService = require('../services/sosService');
const { buildReceiptPdf } = require('../services/receiptService');
const { Payment } = require('../models');

exports.rideTypes = (_req, res) => ok(res, Object.entries(RIDE_TYPES).map(([key, t]) => ({ key, ...t })));

exports.estimate = asyncHandler(async (req, res) => {
  ok(res, await fareService.estimate({ ...req.body, userId: req.user._id }));
});

exports.create = asyncHandler(async (req, res) => {
  const { ride, driversNotified } = await rideService.createRide(req.user, req.body);
  created(res, { ...ride.toJSON(), driversNotified });
});

exports.active = asyncHandler(async (req, res) => {
  const field = req.user.role === 'driver' ? 'driver' : 'rider';
  const ride = await Ride.findOne({ [field]: req.user._id, status: { $in: ACTIVE_RIDE_STATUS } }).select('_id');
  // Also surface a finished ride the rider still has to pay for.
  const unpaid = field === 'rider' ? await Ride.findOne({ rider: req.user._id, paymentStatus: { $in: ['pending', 'failed'] }, status: { $in: ['completed', 'cancelled'] } }).sort({ updatedAt: -1 }).select('_id') : null;
  const target = ride || unpaid;
  ok(res, target ? await rideService.getRideForUser(target._id, req.user) : null);
});

const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, fare_high: { 'fare.total': -1 }, fare_low: { 'fare.total': 1 } };

/** Ride history for the current rider/driver (admins use /admin/rides). */
exports.list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { [req.user.role === 'driver' ? 'driver' : 'rider']: req.user._id };
  if (q.status === 'active') filter.status = { $in: ACTIVE_RIDE_STATUS };
  else if (q.status) filter.status = q.status;
  if (q.rideType) filter.rideType = q.rideType;
  if (q.from || q.to) filter.createdAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  if (q.q) {
    const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ 'pickup.address': rx }, { 'dropoff.address': rx }];
  }
  const skip = (q.page - 1) * q.limit;
  const [items, total, summary] = await Promise.all([
    Ride.find(filter).sort(SORTS[q.sort]).skip(skip).limit(q.limit).populate(rideService.POPULATE).lean(),
    Ride.countDocuments(filter),
    Ride.aggregate([
      { $match: { [req.user.role === 'driver' ? 'driver' : 'rider']: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 }, spend: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$fare.total', 0] } }, km: { $sum: '$distanceKm' } } },
    ]),
  ]);
  ok(res, items, { ...pageMeta(total, q), summary });
});

exports.get = asyncHandler(async (req, res) => ok(res, await rideService.getRideForUser(req.params.id, req.user)));

exports.cancel = asyncHandler(async (req, res) => {
  if (req.user.role === 'driver') {
    ok(res, { ride: await rideService.cancelByDriver(req.params.id, req.user, req.body.reason), cancellationFee: 0 });
  } else {
    ok(res, await rideService.cancelByRider(req.params.id, req.user, req.body.reason));
  }
});

exports.pay = asyncHandler(async (req, res) => {
  const payment = await paymentService.payRide(req.params.id, req.user, req.body);
  ok(res, { payment, ride: await rideService.broadcast(req.params.id) });
});

exports.review = asyncHandler(async (req, res) => created(res, await reviewService.rateRide(req.params.id, req.user, req.body)));

exports.sos = asyncHandler(async (req, res) => created(res, await sosService.trigger(req.params.id, req.user, req.body)));

exports.receipt = asyncHandler(async (req, res) => {
  const ride = await Ride.findById(req.params.id).populate([{ path: 'rider', select: 'name email' }, { path: 'driver', select: 'name driver.vehicle' }]);
  rideService.assertParticipant(ride, req.user);
  const payment = await Payment.findOne({ ride: ride._id, status: 'succeeded' }).sort({ createdAt: -1 });
  if (!payment) throw ApiError.badRequest('A receipt is available once the ride has been paid');
  const pdf = await buildReceiptPdf(ride, payment);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payment.receiptNumber}.pdf"`);
  res.send(pdf);
});

exports.emailReceipt = asyncHandler(async (req, res) => {
  const ride = await Ride.findById(req.params.id);
  rideService.assertParticipant(ride, req.user);
  const result = await paymentService.emailReceipt(req.params.id);
  if (result.status !== 'sent') throw new ApiError(502, 'Could not send the receipt email. Please try again.');
  ok(res, { sent: true, to: req.user.email });
});
