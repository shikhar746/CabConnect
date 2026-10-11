const { Notification, PromoCode } = require('../models');
const { ok, asyncHandler, paginate, pageMeta, ApiError } = require('../utils/http');
const maps = require('../services/maps');
const promoService = require('../services/promoService');

// ---- Maps (proxied so API keys never reach the browser) ----
exports.searchPlaces = asyncHandler(async (req, res) => {
  const { q, lat, lng } = req.query;
  if (!q || String(q).trim().length < 2) return ok(res, []);
  const near = lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;
  return ok(res, await maps.search(String(q).slice(0, 100), near));
});

exports.reverseGeocode = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw ApiError.badRequest('lat and lng are required');
  ok(res, await maps.reverseGeocode({ lat, lng }));
});

// ---- Notifications ----
exports.listNotifications = asyncHandler(async (req, res) => {
  const p = paginate(req.query, { limit: 20, max: 50 });
  const filter = { user: req.user._id, ...(req.query.unread === 'true' && { read: false }) };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  ok(res, items, { ...pageMeta(total, p), unread });
});

exports.markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
  ok(res, { read: true });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  ok(res, { updated: r.modifiedCount });
});

// ---- Promos (rider-facing) ----
exports.activePromos = asyncHandler(async (_req, res) => {
  const now = new Date();
  const promos = await PromoCode.find({ isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] })
    .select('code description discountType value maxDiscount minFare expiresAt').sort({ createdAt: -1 }).lean();
  ok(res, promos);
});

exports.validatePromo = asyncHandler(async (req, res) => {
  const { promo, discount } = await promoService.evaluate(req.body.code, req.user._id, req.body.subtotal);
  ok(res, { code: promo.code, description: promo.description, discount });
});
