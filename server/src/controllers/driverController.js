const mongoose = require('mongoose');
const { User, Ride, Review, Payment, Payout } = require('../models');
const { ApiError, ok, asyncHandler, paginate, pageMeta } = require('../utils/http');
const rideService = require('../services/rideService');
const matching = require('../services/matchingService');
const tracking = require('../services/trackingService');
const paymentService = require('../services/paymentService');

exports.setStatus = asyncHandler(async (req, res) => {
  const { isOnline, lat, lng } = req.body;
  const d = req.user.driver;
  if (!d?.vehicle?.type) throw ApiError.badRequest('Add your vehicle details before going online');
  if (!isOnline && d.isBusy) throw ApiError.conflict('Finish your current ride before going offline');
  d.isOnline = isOnline;
  if (typeof lat === 'number' && typeof lng === 'number') d.location = { type: 'Point', coordinates: [lng, lat] };
  if (isOnline && !d.location?.coordinates?.length) throw ApiError.badRequest('Share your location to go online');
  await req.user.save();
  ok(res, { user: req.user.toJSON(), requests: isOnline ? await matching.openRequestsFor(req.user) : [] });
});

exports.updateLocation = asyncHandler(async (req, res) => {
  const result = await tracking.reportDriverLocation(req.user._id, req.body);
  ok(res, { updated: true, etaMin: result?.etaMin });
});

exports.requests = asyncHandler(async (req, res) => ok(res, await matching.openRequestsFor(req.user)));

exports.accept = asyncHandler(async (req, res) => ok(res, await rideService.acceptRide(req.params.id, req.user)));
exports.decline = asyncHandler(async (req, res) => ok(res, await rideService.declineRide(req.params.id, req.user)));
exports.arrive = asyncHandler(async (req, res) => ok(res, await rideService.markArrived(req.params.id, req.user._id)));
exports.start = asyncHandler(async (req, res) => ok(res, await rideService.startRide(req.params.id, req.user._id, req.body.otp)));
exports.complete = asyncHandler(async (req, res) => ok(res, await rideService.completeRide(req.params.id, req.user._id)));

/** Earnings dashboard: totals, today/week figures and a 14-day daily series. */
exports.earnings = asyncHandler(async (req, res) => {
  const driverId = new mongoose.Types.ObjectId(String(req.user._id));
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const since = new Date(startOfToday); since.setDate(since.getDate() - 13);
  const weekStart = new Date(startOfToday); weekStart.setDate(weekStart.getDate() - 6);

  const [daily, byMethod, trips, payouts] = await Promise.all([
    Payment.aggregate([
      { $match: { driver: driverId, status: 'succeeded', kind: 'ride_fare', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, earnings: { $sum: '$driverEarning' }, trips: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: { driver: driverId, status: 'succeeded', kind: 'ride_fare' } },
      { $group: { _id: '$method', earnings: { $sum: '$driverEarning' }, count: { $sum: 1 } } },
    ]),
    Ride.aggregate([
      { $match: { driver: driverId } },
      { $group: { _id: '$status', count: { $sum: 1 }, km: { $sum: '$distanceKm' } } },
    ]),
    Payout.find({ driver: req.user._id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const series = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(since); d.setDate(d.getDate() + i);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const hit = daily.find((x) => x._id === key);
    series.push({ date: key, earnings: Math.round(hit?.earnings || 0), trips: hit?.trips || 0 });
  }
  const todayKey = startOfToday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const weekKey = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const sum = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
  const today = series.filter((s) => s.date === todayKey);
  const week = series.filter((s) => s.date >= weekKey);

  ok(res, {
    totalEarnings: Math.round(req.user.driver.totalEarnings || 0),
    pendingPayout: Math.round((req.user.driver.pendingPayout || 0) * 100) / 100,
    today: { earnings: sum(today, 'earnings'), trips: sum(today, 'trips') },
    week: { earnings: sum(week, 'earnings'), trips: sum(week, 'trips') },
    rating: req.user.driver.rating,
    ratingCount: req.user.driver.ratingCount,
    series,
    byMethod,
    trips,
    payouts,
  });
});

exports.payout = asyncHandler(async (req, res) => ok(res, await paymentService.requestPayout(req.user)));

exports.myReviews = asyncHandler(async (req, res) => {
  const p = paginate(req.query);
  const [items, total, dist] = await Promise.all([
    Review.find({ driver: req.user._id }).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('rider', 'name avatarUrl').lean(),
    Review.countDocuments({ driver: req.user._id }),
    Review.aggregate([{ $match: { driver: req.user._id } }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
  ]);
  ok(res, items, { ...pageMeta(total, p), distribution: dist });
});

/** Public driver profile with average rating & recent reviews. */
exports.publicProfile = asyncHandler(async (req, res) => {
  const driver = await User.findOne({ _id: req.params.id, role: 'driver' }).select('name avatarUrl driver.vehicle driver.rating driver.ratingCount createdAt');
  if (!driver) throw ApiError.notFound('Driver not found');
  const [reviews, trips] = await Promise.all([
    Review.find({ driver: driver._id }).sort({ createdAt: -1 }).limit(10).populate('rider', 'name').lean(),
    Ride.countDocuments({ driver: driver._id, status: 'completed' }),
  ]);
  ok(res, {
    _id: driver._id, name: driver.name, avatarUrl: driver.avatarUrl, memberSince: driver.createdAt,
    vehicle: driver.driver.vehicle, rating: driver.driver.rating, ratingCount: driver.driver.ratingCount, trips,
    reviews: reviews.map((r) => ({ ...r, rider: r.rider ? { name: r.rider.name.split(' ')[0] } : null })),
  });
});
