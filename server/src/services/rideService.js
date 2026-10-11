const crypto = require('crypto');
const env = require('../config/env');
const { Ride, User, Payment } = require('../models');
const { ACTIVE_RIDE_STATUS, RIDE_TYPES } = require('../config/constants');
const { ApiError } = require('../utils/http');
const { haversineKm } = require('../utils/geo');
const fareService = require('./fareService');
const promoService = require('./promoService');
const matching = require('./matchingService');
const tracking = require('./trackingService');
const notifications = require('./notificationService');
const sockets = require('../sockets');

const REQUEST_TIMEOUT_MIN = 5;

const POPULATE = [
  { path: 'driver', select: 'name phone avatarUrl driver.vehicle driver.rating driver.ratingCount driver.location' },
  { path: 'rider', select: 'name phone avatarUrl riderRating' },
];

async function loadRide(rideId, { withOtp = false } = {}) {
  const q = Ride.findById(rideId).populate(POPULATE);
  if (withOtp) q.select('+otp');
  return q;
}

/** Pushes the fresh ride state to everyone watching it. */
async function broadcast(rideId) {
  const ride = await loadRide(rideId);
  if (!ride) return null;
  const json = ride.toJSON();
  sockets.emitToRide(String(rideId), 'ride:update', json);
  sockets.emitToUser(String(ride.rider._id), 'ride:update', json);
  if (ride.driver) sockets.emitToUser(String(ride.driver._id), 'ride:update', json);
  return ride;
}

function assertParticipant(ride, user) {
  if (!ride) throw ApiError.notFound('Ride not found');
  const isRider = String(ride.rider._id || ride.rider) === String(user._id);
  const isDriver = ride.driver && String(ride.driver._id || ride.driver) === String(user._id);
  if (!isRider && !isDriver && user.role !== 'admin') throw ApiError.forbidden();
  return { isRider, isDriver };
}

async function createRide(user, input) {
  const active = await Ride.exists({ rider: user._id, status: { $in: ACTIVE_RIDE_STATUS } });
  if (active) throw ApiError.conflict('You already have an active ride');

  const { pickup, stops = [], dropoff, rideType, promoCode, paymentMethod = 'cash', paymentMethodId } = input;
  if (!RIDE_TYPES[rideType]) throw ApiError.badRequest('Unknown ride type');
  if (haversineKm(pickup, dropoff) < 0.2 && !stops.length) throw ApiError.badRequest('Pickup and drop-off are too close');

  if (['card', 'upi'].includes(paymentMethod)) {
    const pm = user.paymentMethods.id(paymentMethodId);
    if (!pm || pm.type !== paymentMethod) throw ApiError.badRequest(`Select a saved ${paymentMethod === 'card' ? 'card' : 'UPI ID'} to pay with`);
  }

  const quote = await fareService.estimate({ pickup, stops, dropoff, rideTypes: [rideType] });
  const option = quote.options[0];
  const fare = { ...option.fare };
  let promo;
  if (promoCode) {
    const res = await promoService.evaluate(promoCode, user._id, fare.subtotal);
    promo = res.promo;
    fare.discount = res.discount;
    fare.total = fare.subtotal - res.discount;
  }

  const ride = await Ride.create({
    rider: user._id,
    pickup, stops, dropoff, rideType,
    distanceKm: quote.distanceKm,
    durationMin: option.durationMin,
    route: quote.path,
    fare,
    promoCode: promo?.code,
    paymentMethod,
    paymentMethodId: ['card', 'upi'].includes(paymentMethod) ? paymentMethodId : undefined,
    otp: String(crypto.randomInt(1000, 10000)),
  });
  if (promo) await promoService.consume(promo._id, user._id);

  const offered = await matching.dispatch(ride._id);
  const full = await loadRide(ride._id, { withOtp: true });
  return { ride: full, driversNotified: offered.length };
}

async function acceptRide(rideId, driver) {
  if (!driver.driver?.isOnline) throw ApiError.badRequest('Go online to accept rides');
  // Claim the driver first so one driver can never hold two rides at once.
  const claimed = await User.findOneAndUpdate({ _id: driver._id, 'driver.isBusy': false }, { 'driver.isBusy': true });
  if (!claimed) throw ApiError.conflict('Finish your current ride first');

  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, status: 'requested', rideType: driver.driver.vehicle?.type, declinedBy: { $ne: driver._id } },
    { status: 'accepted', driver: driver._id, 'timeline.acceptedAt': new Date() },
    { new: true },
  );
  if (!ride) {
    await User.updateOne({ _id: driver._id }, { 'driver.isBusy': false });
    throw ApiError.conflict('This ride is no longer available');
  }
  const coords = driver.driver.location?.coordinates;
  if (coords) {
    ride.driverLocation = { lat: coords[1], lng: coords[0] };
    ride.etaMin = Math.max(1, Math.round(((haversineKm(ride.driverLocation, ride.pickup) * 1.3) / 24) * 60));
    await ride.save();
  }

  // Tell other drivers the request is gone.
  ride.offeredTo.filter((id) => String(id) !== String(driver._id))
    .forEach((id) => sockets.emitToUser(String(id), 'ride:taken', { rideId: String(ride._id) }));

  await notifications.notify(ride.rider, {
    type: 'ride',
    title: 'Driver assigned',
    body: `${driver.name} is on the way in a ${driver.driver.vehicle?.color || ''} ${driver.driver.vehicle?.make || ''} ${driver.driver.vehicle?.model || ''} (${driver.driver.vehicle?.plate || ''}). ETA ${ride.etaMin ?? '–'} min.`,
    ride: ride._id,
    link: `/ride/${ride._id}`,
  });
  await tracking.startLeg(String(ride._id), 'to_pickup');
  return broadcast(ride._id);
}

async function declineRide(rideId, driver) {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, status: 'requested' },
    { $addToSet: { declinedBy: driver._id }, $pull: { offeredTo: driver._id } },
    { new: true },
  );
  if (!ride) throw ApiError.notFound('Ride request not found');
  // Everyone offered declined -> widen the search to the next nearest drivers.
  if (!ride.offeredTo.length) await matching.dispatch(ride._id);
  return { declined: true };
}

async function markArrived(rideId, driverId, { system = false } = {}) {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, driver: driverId, status: 'accepted' },
    { status: 'arriving', 'timeline.arrivedAt': new Date(), etaMin: 0 },
    { new: true },
  );
  if (!ride) {
    if (system) return null;
    throw ApiError.conflict('Ride is not awaiting pickup');
  }
  tracking.stop(String(rideId));
  await notifications.notify(ride.rider, { type: 'ride', title: 'Your driver has arrived', body: 'Share your 4-digit ride PIN with the driver to start the trip.', ride: ride._id, link: `/ride/${rideId}` });
  return broadcast(ride._id);
}

async function startRide(rideId, driverId, otp) {
  const ride = await Ride.findOne({ _id: rideId, driver: driverId }).select('+otp');
  if (!ride) throw ApiError.notFound('Ride not found');
  if (!['accepted', 'arriving'].includes(ride.status)) throw ApiError.conflict('Ride cannot be started now');
  if (String(otp) !== ride.otp) throw ApiError.badRequest('Incorrect ride PIN');
  ride.status = 'in_progress';
  ride.timeline.startedAt = new Date();
  if (!ride.timeline.arrivedAt) ride.timeline.arrivedAt = ride.timeline.startedAt;
  await ride.save();
  await notifications.notify(ride.rider, { type: 'ride', title: 'Ride started', body: `Heading to ${ride.dropoff.address}. Enjoy your trip!`, ride: ride._id, link: `/ride/${rideId}` });
  await tracking.startLeg(String(ride._id), 'on_trip');
  return broadcast(ride._id);
}

async function completeRide(rideId, driverId) {
  const ride = await Ride.findOne({ _id: rideId, driver: driverId });
  if (!ride) throw ApiError.notFound('Ride not found');
  if (ride.status !== 'in_progress') throw ApiError.conflict('Only an in-progress ride can be completed');
  tracking.stop(String(ride._id));

  ride.status = 'completed';
  ride.timeline.completedAt = new Date();
  ride.etaMin = 0;
  ride.driverLocation = { lat: ride.dropoff.lat, lng: ride.dropoff.lng };
  await ride.save();
  await User.updateOne({ _id: driverId }, {
    'driver.isBusy': false,
    'driver.location': { type: 'Point', coordinates: [ride.dropoff.lng, ride.dropoff.lat] },
  });

  // Cash is collected by the driver at drop-off; everything else is paid in-app.
  if (ride.paymentMethod === 'cash') {
    // eslint-disable-next-line global-require
    await require('./paymentService').recordCashPayment(ride);
  } else {
    await notifications.notify(ride.rider, { type: 'payment', title: `Trip complete – ₹${ride.fare.total} due`, body: 'Complete your payment and rate your driver.', ride: ride._id, link: `/ride/${rideId}` });
  }
  return broadcast(ride._id);
}

/** Free within CANCELLATION_FREE_WINDOW_MIN after a driver accepts; a flat fee after that. */
function cancellationFeeFor(ride, now = new Date()) {
  if (!['accepted', 'arriving'].includes(ride.status) || !ride.timeline.acceptedAt) return 0;
  const mins = (now - ride.timeline.acceptedAt) / 60000;
  return mins > env.cancellationFreeWindowMin ? env.cancellationFee : 0;
}

async function cancelByRider(rideId, rider, reason) {
  const ride = await Ride.findById(rideId);
  assertParticipant(ride, rider);
  if (!['requested', 'accepted', 'arriving'].includes(ride.status)) throw ApiError.conflict('This ride can no longer be cancelled');

  const fee = cancellationFeeFor(ride);
  const hadDriver = ride.driver;
  ride.status = 'cancelled';
  ride.cancelledBy = 'rider';
  ride.cancelReason = reason;
  ride.timeline.cancelledAt = new Date();
  ride.fare.cancellationFee = fee;
  ride.paymentStatus = fee > 0 ? 'pending' : 'not_required';
  await ride.save();
  tracking.stop(String(ride._id));
  await promoService.release(ride.promoCode, rider._id);

  if (hadDriver) {
    await User.updateOne({ _id: hadDriver }, { 'driver.isBusy': false });
    await notifications.notify(hadDriver, { type: 'ride', title: 'Ride cancelled by rider', body: reason || 'The rider cancelled this trip.', ride: ride._id, link: '/driver' });
  }
  ride.offeredTo.forEach((id) => sockets.emitToUser(String(id), 'ride:taken', { rideId: String(ride._id) }));
  await notifications.notify(rider._id, {
    type: 'ride',
    title: 'Ride cancelled',
    body: fee > 0 ? `A cancellation fee of ₹${fee} applies as the driver was already on the way.` : 'Your ride was cancelled at no charge.',
    ride: ride._id,
    link: fee > 0 ? `/ride/${ride._id}` : '/history',
  });
  return { ride: await broadcast(ride._id), cancellationFee: fee };
}

/** A driver backing out puts the ride back into matching (no fee for the rider). */
async function cancelByDriver(rideId, driver, reason) {
  const ride = await Ride.findOne({ _id: rideId, driver: driver._id });
  if (!ride) throw ApiError.notFound('Ride not found');
  if (!['accepted', 'arriving'].includes(ride.status)) throw ApiError.conflict('This ride can no longer be cancelled');
  tracking.stop(String(ride._id));
  ride.status = 'requested';
  ride.driver = undefined;
  ride.driverLocation = undefined;
  ride.etaMin = undefined;
  ride.timeline.acceptedAt = undefined;
  ride.timeline.arrivedAt = undefined;
  ride.declinedBy.addToSet(driver._id);
  await ride.save();
  await User.updateOne({ _id: driver._id }, { 'driver.isBusy': false });
  await notifications.notify(ride.rider, { type: 'ride', title: 'Finding you another driver', body: `Your driver had to cancel${reason ? ` (${reason})` : ''}. We're matching you with someone nearby.`, ride: ride._id, link: `/ride/${ride._id}` });
  await matching.dispatch(ride._id);
  return broadcast(ride._id);
}

/** Cancels requests no driver accepted within REQUEST_TIMEOUT_MIN. Run periodically. */
async function expireStaleRequests() {
  const cutoff = new Date(Date.now() - REQUEST_TIMEOUT_MIN * 60000);
  const stale = await Ride.find({ status: 'requested', 'timeline.requestedAt': { $lt: cutoff } });
  for (const ride of stale) {
    ride.status = 'cancelled';
    ride.cancelledBy = 'system';
    ride.cancelReason = 'No drivers available nearby';
    ride.timeline.cancelledAt = new Date();
    ride.paymentStatus = 'not_required';
    // eslint-disable-next-line no-await-in-loop
    await ride.save();
    // eslint-disable-next-line no-await-in-loop
    await promoService.release(ride.promoCode, ride.rider);
    // eslint-disable-next-line no-await-in-loop
    await notifications.notify(ride.rider, { type: 'ride', title: 'No drivers available', body: 'Sorry, we could not find a driver. Please try again shortly.', ride: ride._id, link: '/book' });
    // eslint-disable-next-line no-await-in-loop
    await broadcast(ride._id);
  }
  return stale.length;
}

async function getRideForUser(rideId, user) {
  const ride = await Ride.findById(rideId).populate(POPULATE).select('+otp');
  const { isRider } = assertParticipant(ride, user);
  const json = ride.toJSON();
  if (!isRider && user.role !== 'admin') delete json.otp; // only the rider sees the PIN
  json.payment = await Payment.findOne({ ride: ride._id, status: 'succeeded' }).sort({ createdAt: -1 }).lean();
  json.cancellationFeeIfCancelledNow = cancellationFeeFor(ride);
  return json;
}

module.exports = {
  POPULATE, loadRide, broadcast, assertParticipant,
  createRide, acceptRide, declineRide, markArrived, startRide, completeRide,
  cancelByRider, cancelByDriver, cancellationFeeFor, expireStaleRequests, getRideForUser,
};
