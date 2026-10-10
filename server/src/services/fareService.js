const { RIDE_TYPES, STOP_FEE } = require('../config/constants');
const { Ride, User } = require('../models');
const maps = require('./maps');
const promoService = require('./promoService');
const { round } = require('../utils/geo');
const env = require('../config/env');

const PEAK_HOURS = [[8, 10], [17, 21]];

function peakMultiplier(date = new Date()) {
  const h = date.getHours();
  return PEAK_HOURS.some(([s, e]) => h >= s && h < e) ? 1.2 : 1;
}

/**
 * Demand-based surge: ratio of open requests (last 10 min) to idle online drivers
 * of that ride type. Combined with a time-of-day peak factor. Capped at 2x.
 */
async function surgeFor(rideType) {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const [demand, supply] = await Promise.all([
    Ride.countDocuments({ rideType, status: 'requested', createdAt: { $gte: since } }),
    User.countDocuments({ role: 'driver', 'driver.isOnline': true, 'driver.isBusy': false, 'driver.vehicle.type': rideType }),
  ]);
  const ratio = demand / Math.max(1, supply);
  const demandSurge = ratio > 1 ? 1 + (ratio - 1) * 0.25 : 1;
  return Math.min(2, round(Math.max(demandSurge, peakMultiplier()), 1));
}

function computeFare(rideType, { distanceKm, durationMin, stopsCount = 0, surge = 1 }) {
  const t = RIDE_TYPES[rideType];
  const baseFare = t.baseFare;
  const distanceFare = round(t.perKm * distanceKm, 0);
  const timeFare = round(t.perMin * durationMin, 0);
  const stopsFare = stopsCount * STOP_FEE;
  const raw = Math.max(t.minFare, baseFare + distanceFare + timeFare + stopsFare);
  const subtotal = round(raw * surge, 0);
  return { baseFare, distanceFare, timeFare, stopsFare, surgeMultiplier: surge, subtotal, discount: 0, total: subtotal, currency: env.currency };
}

/**
 * Returns a route plus a fare quote per ride type. If a promo is supplied, it's
 * evaluated for every option; an invalid promo is reported, not thrown.
 */
async function estimate({ pickup, stops = [], dropoff, promoCode, userId, rideTypes = Object.keys(RIDE_TYPES) }) {
  const route = await maps.route([pickup, ...stops, dropoff]);
  // Load the promo once; only the minimum-fare check differs per ride type.
  let promoDoc;
  let promoLoadError;
  if (promoCode) {
    try { promoDoc = await promoService.loadUsable(promoCode, userId); } catch (e) { promoLoadError = e.message; }
  }
  const options = await Promise.all(rideTypes.map(async (type) => {
    const t = RIDE_TYPES[type];
    const surge = await surgeFor(type);
    // Two-wheelers/autos travel a bit faster in traffic.
    const durationMin = Math.max(3, Math.round((route.distanceKm / t.speedKmh) * 60));
    const fare = computeFare(type, { distanceKm: route.distanceKm, durationMin, stopsCount: stops.length, surge });
    let promoError = promoLoadError;
    if (promoDoc) {
      try {
        const discount = promoService.discountFor(promoDoc, fare.subtotal);
        fare.discount = discount;
        fare.total = fare.subtotal - discount;
      } catch (e) {
        promoError = e.message;
      }
    }
    return { rideType: type, label: t.label, description: t.description, capacity: t.capacity, durationMin, fare, ...(promoError && { promoError }) };
  }));
  // A promo can apply to some ride types (e.g. above a minimum fare) and not others.
  let promo;
  if (promoCode) {
    const applies = options.some((o) => !o.promoError);
    promo = { code: promoCode.toUpperCase(), valid: applies, ...(!applies && { error: options[0].promoError }) };
  }
  return { distanceKm: route.distanceKm, durationMin: route.durationMin, path: route.path, options, promo };
}

module.exports = { estimate, computeFare, surgeFor, peakMultiplier };
