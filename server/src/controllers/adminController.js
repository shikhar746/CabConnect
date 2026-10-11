const { User, Ride, Payment, PromoCode, SosAlert, MessageLog, SupportTicket } = require('../models');
const { ACTIVE_RIDE_STATUS } = require('../config/constants');
const { ApiError, ok, created, asyncHandler, paginate, pageMeta, escapeRegex } = require('../utils/http');
const sosService = require('../services/sosService');
const rideService = require('../services/rideService');

exports.stats = asyncHandler(async (_req, res) => {
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 13);
  const [users, ridesByStatus, revenue, daily, byType, topDrivers, onlineDrivers, openTickets, activeSos] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Ride.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'succeeded' } }, { $group: { _id: null, gross: { $sum: '$amount' }, platform: { $sum: '$platformFee' }, driver: { $sum: '$driverEarning' } } }]),
    Ride.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        rides: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, { $cond: [{ $eq: ['$status', 'cancelled'] }, '$fare.cancellationFee', '$fare.total'] }, 0] } },
      } },
      { $sort: { _id: 1 } },
    ]),
    Ride.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: '$rideType', count: { $sum: 1 }, revenue: { $sum: '$fare.total' } } }]),
    User.find({ role: 'driver' }).sort({ 'driver.totalEarnings': -1 }).limit(5).select('name driver.rating driver.ratingCount driver.totalEarnings driver.vehicle.type').lean(),
    User.countDocuments({ role: 'driver', 'driver.isOnline': true }),
    SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    SosAlert.countDocuments({ status: { $ne: 'resolved' } }),
  ]);

  const series = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(since); d.setDate(d.getDate() + i);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const hit = daily.find((x) => x._id === key) || {};
    series.push({ date: key, rides: hit.rides || 0, completed: hit.completed || 0, cancelled: hit.cancelled || 0, revenue: Math.round(hit.revenue || 0) });
  }
  const count = (arr, id) => arr.find((x) => x._id === id)?.count || 0;
  ok(res, {
    users: { riders: count(users, 'rider'), drivers: count(users, 'driver'), admins: count(users, 'admin'), onlineDrivers },
    rides: Object.fromEntries(ridesByStatus.map((r) => [r._id, r.count])),
    activeRides: ridesByStatus.filter((r) => ACTIVE_RIDE_STATUS.includes(r._id)).reduce((s, r) => s + r.count, 0),
    revenue: { gross: Math.round(revenue[0]?.gross || 0), platform: Math.round(revenue[0]?.platform || 0), driver: Math.round(revenue[0]?.driver || 0) },
    series, byType, topDrivers, openTickets, activeSos,
  });
});

exports.users = asyncHandler(async (req, res) => {
  const p = paginate(req.query, { limit: 15, max: 50 });
  const filter = {};
  if (['rider', 'driver', 'admin'].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.status === 'active') filter.isActive = true;
  if (req.query.status === 'suspended') filter.isActive = false;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    User.countDocuments(filter),
  ]);
  ok(res, items.map((u) => u.toJSON()), pageMeta(total, p));
});

exports.updateUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('You cannot modify your own admin account here');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (req.body.isActive === false && user.role === 'driver') {
    if (user.driver?.isBusy) throw ApiError.conflict('Driver is on a ride – try again after it ends');
    user.driver.isOnline = false;
  }
  Object.assign(user, req.body);
  await user.save();
  ok(res, user.toJSON());
});

exports.rides = asyncHandler(async (req, res) => {
  const p = paginate(req.query, { limit: 15, max: 50 });
  const filter = {};
  if (req.query.status === 'active') filter.status = { $in: ACTIVE_RIDE_STATUS };
  else if (req.query.status) filter.status = req.query.status;
  if (req.query.rideType) filter.rideType = req.query.rideType;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ 'pickup.address': rx }, { 'dropoff.address': rx }];
  }
  const [items, total] = await Promise.all([
    Ride.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate(rideService.POPULATE).lean(),
    Ride.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(total, p));
});

exports.payments = asyncHandler(async (req, res) => {
  const p = paginate(req.query, { limit: 15, max: 50 });
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('rider', 'name').populate('driver', 'name').lean(),
    Payment.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(total, p));
});

// ---- Promo codes ----
exports.promos = asyncHandler(async (_req, res) => ok(res, await PromoCode.find().sort({ createdAt: -1 }).select('-usedBy').lean()));

exports.createPromo = asyncHandler(async (req, res) => {
  if (await PromoCode.exists({ code: req.body.code })) throw ApiError.conflict('A promo with this code already exists');
  created(res, await PromoCode.create(req.body));
});

exports.updatePromo = asyncHandler(async (req, res) => {
  const promo = await PromoCode.findById(req.params.id);
  if (!promo) throw ApiError.notFound('Promo not found');
  if (req.body.code !== promo.code && (await PromoCode.exists({ code: req.body.code }))) throw ApiError.conflict('A promo with this code already exists');
  Object.assign(promo, req.body);
  await promo.save();
  ok(res, promo);
});

exports.deletePromo = asyncHandler(async (req, res) => {
  const r = await PromoCode.deleteOne({ _id: req.params.id });
  if (!r.deletedCount) throw ApiError.notFound('Promo not found');
  ok(res, { deleted: true });
});

// ---- SOS ----
exports.sosList = asyncHandler(async (req, res) => {
  const p = paginate(req.query);
  const filter = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([
    SosAlert.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit)
      .populate('user', 'name phone role')
      .populate({ path: 'ride', select: 'pickup dropoff status driver rider', populate: { path: 'driver', select: 'name phone driver.vehicle' } })
      .lean(),
    SosAlert.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(total, p));
});

exports.resolveSos = asyncHandler(async (req, res) => ok(res, await sosService.resolve(req.params.id, req.user, req.body)));

// ---- Outbox (emails/SMS sent by real or mock providers) ----
exports.outbox = asyncHandler(async (req, res) => {
  const p = paginate(req.query, { limit: 20, max: 50 });
  const filter = ['email', 'sms'].includes(req.query.channel) ? { channel: req.query.channel } : {};
  const [items, total] = await Promise.all([
    MessageLog.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    MessageLog.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(total, p));
});
