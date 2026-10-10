const { PromoCode } = require('../models');
const { ApiError } = require('../utils/http');
const { round } = require('../utils/geo');

/**
 * Loads a promo and checks the rules that don't depend on the fare
 * (active, expiry, usage limits). Throws ApiError if unusable.
 */
async function loadUsable(code, userId) {
  const promo = await PromoCode.findOne({ code: String(code).toUpperCase().trim() });
  if (!promo || !promo.isActive) throw ApiError.badRequest('Promo code is invalid');
  if (promo.expiresAt && promo.expiresAt < new Date()) throw ApiError.badRequest('Promo code has expired');
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) throw ApiError.badRequest('Promo code usage limit reached');
  const mine = promo.usedBy.find((u) => String(u.user) === String(userId));
  if (mine && mine.count >= promo.perUserLimit) throw ApiError.badRequest('You have already used this promo code');
  return promo;
}

/** Fare-dependent part: minimum fare and the discount amount. Pure – no DB access. */
function discountFor(promo, subtotal) {
  if (subtotal < promo.minFare) throw ApiError.badRequest(`Promo requires a minimum fare of ₹${promo.minFare}`);
  let discount = promo.discountType === 'percent' ? (subtotal * promo.value) / 100 : promo.value;
  // The cap only applies to percentage promos; a flat promo is always its face value.
  if (promo.discountType === 'percent' && promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
  return round(Math.min(discount, subtotal), 0);
}

/** Validates a promo for a user & fare; returns { promo, discount }. Throws ApiError if invalid. */
async function evaluate(code, userId, subtotal) {
  const promo = await loadUsable(code, userId);
  return { promo, discount: discountFor(promo, subtotal) };
}

async function consume(promoId, userId) {
  const promo = await PromoCode.findById(promoId);
  if (!promo) return;
  promo.usedCount += 1;
  const mine = promo.usedBy.find((u) => String(u.user) === String(userId));
  if (mine) mine.count += 1; else promo.usedBy.push({ user: userId, count: 1 });
  await promo.save();
}

async function release(code, userId) {
  if (!code) return;
  const promo = await PromoCode.findOne({ code });
  if (!promo) return;
  const mine = promo.usedBy.find((u) => String(u.user) === String(userId));
  if (mine && mine.count > 0) {
    mine.count -= 1;
    promo.usedCount = Math.max(0, promo.usedCount - 1);
    await promo.save();
  }
}

module.exports = { evaluate, loadUsable, discountFor, consume, release };
