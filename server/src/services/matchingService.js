const env = require('../config/env');
const { User, Ride } = require('../models');
const sockets = require('../sockets');
const { haversineKm, round } = require('../utils/geo');

const MAX_OFFERS = 5;

/** Online, idle drivers of the ride's vehicle type within MATCH_RADIUS_KM, nearest first. */
async function findNearbyDrivers(ride, { exclude = [] } = {}) {
  const drivers = await User.find({
    role: 'driver',
    isActive: true,
    'driver.isOnline': true,
    'driver.isBusy': false,
    'driver.vehicle.type': ride.rideType,
    _id: { $nin: exclude },
    'driver.location.coordinates': { $exists: true },
    'driver.location': {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [ride.pickup.lng, ride.pickup.lat] },
        $maxDistance: env.matchRadiusKm * 1000,
      },
    },
  }).limit(MAX_OFFERS);
  return drivers;
}

/** Shape of a ride request as shown to drivers. */
function requestView(ride, driver) {
  const coords = driver?.driver?.location?.coordinates;
  const distanceToPickupKm = coords ? round(haversineKm({ lat: coords[1], lng: coords[0] }, ride.pickup), 1) : undefined;
  return {
    _id: ride._id,
    pickup: ride.pickup,
    stops: ride.stops,
    dropoff: ride.dropoff,
    rideType: ride.rideType,
    distanceKm: ride.distanceKm,
    durationMin: ride.durationMin,
    fare: ride.fare,
    paymentMethod: ride.paymentMethod,
    distanceToPickupKm,
    createdAt: ride.createdAt,
  };
}

/** Offers a requested ride to nearby drivers over WebSocket. Returns the drivers offered. */
async function dispatch(rideId) {
  const ride = await Ride.findById(rideId);
  if (!ride || ride.status !== 'requested') return [];
  const drivers = await findNearbyDrivers(ride, { exclude: ride.declinedBy });
  ride.offeredTo = drivers.map((d) => d._id);
  await ride.save();
  drivers.forEach((d) => sockets.emitToUser(String(d._id), 'ride:request', requestView(ride, d)));
  return drivers;
}

/** Requested rides a given driver can currently accept (used when a driver goes online / refreshes). */
async function openRequestsFor(driver) {
  const coords = driver.driver?.location?.coordinates;
  if (!driver.driver?.isOnline || driver.driver?.isBusy || !coords) return [];
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const rides = await Ride.find({
    status: 'requested',
    rideType: driver.driver.vehicle?.type,
    declinedBy: { $ne: driver._id },
    createdAt: { $gte: since },
  }).sort({ createdAt: -1 }).limit(20);
  const here = { lat: coords[1], lng: coords[0] };
  return rides
    .filter((r) => haversineKm(here, r.pickup) <= env.matchRadiusKm)
    .map((r) => requestView(r, driver));
}

module.exports = { findNearbyDrivers, dispatch, openRequestsFor, requestView };
