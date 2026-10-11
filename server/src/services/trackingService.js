const env = require('../config/env');
const { Ride, User } = require('../models');
const maps = require('./maps');
const sockets = require('../sockets');
const { haversineKm } = require('../utils/geo');
const logger = require('../utils/logger');

/**
 * Live tracking. Location updates can come from a real driver device
 * (socket "driver:location") or from this built-in simulator, which walks the
 * driver along the route so the demo works with no GPS hardware.
 */
const sims = new Map(); // rideId -> { timer, phase, path, idx, notifiedArriving }
const SIM_TICKS_PER_LEG = 30; // a leg (to pickup / trip) completes in ~30 ticks

function remainingKm(path, idx) {
  let km = 0;
  for (let i = idx; i < path.length - 1; i += 1) km += haversineKm(path[i], path[i + 1]);
  return km * 1.3;
}

async function reportDriverLocation(driverId, loc, rideId, { fromSimulator = false } = {}) {
  await User.updateOne({ _id: driverId }, { 'driver.location': { type: 'Point', coordinates: [loc.lng, loc.lat] } });
  const ride = rideId
    ? await Ride.findOne({ _id: rideId, driver: driverId })
    : await Ride.findOne({ driver: driverId, status: { $in: ['accepted', 'arriving', 'in_progress'] } });
  if (!ride || !['accepted', 'arriving', 'in_progress'].includes(ride.status)) return null;
  if (!fromSimulator) stop(String(ride._id)); // real GPS takes over

  const target = ride.status === 'in_progress' ? ride.dropoff : ride.pickup;
  const etaMin = Math.max(0, Math.round(((haversineKm(loc, target) * 1.3) / 24) * 60));
  ride.driverLocation = { lat: loc.lat, lng: loc.lng };
  ride.etaMin = etaMin;
  await ride.save();
  sockets.emitToRide(String(ride._id), 'ride:location', { rideId: String(ride._id), lat: loc.lat, lng: loc.lng, etaMin, status: ride.status });
  return { ride, etaMin };
}

function stop(rideId) {
  const sim = sims.get(rideId);
  if (sim) {
    clearInterval(sim.timer);
    sims.delete(rideId);
  }
}

async function startLeg(rideId, phase) {
  stop(rideId);
  if (!env.simulateDriverMovement) return;
  const ride = await Ride.findById(rideId).populate('driver', 'driver.location');
  if (!ride || !ride.driver) return;

  let path;
  if (phase === 'to_pickup') {
    const coords = ride.driver.driver?.location?.coordinates;
    const from = coords ? { lat: coords[1], lng: coords[0] } : { lat: ride.pickup.lat + 0.01, lng: ride.pickup.lng + 0.01 };
    path = (await maps.route([from, ride.pickup])).path;
  } else {
    path = ride.route?.length ? ride.route.map((p) => ({ lat: p.lat, lng: p.lng })) : (await maps.route([ride.pickup, ...ride.stops, ride.dropoff])).path;
  }
  const step = Math.max(1, Math.ceil(path.length / SIM_TICKS_PER_LEG));
  const sim = { phase, path, idx: 0, notifiedArriving: false };
  const driverId = String(ride.driver._id);
  // eslint-disable-next-line global-require
  const notifications = require('./notificationService');

  sim.timer = setInterval(async () => {
    try {
      sim.idx = Math.min(path.length - 1, sim.idx + step);
      const res = await reportDriverLocation(driverId, path[sim.idx], rideId, { fromSimulator: true });
      if (!res) return stop(rideId);
      const left = remainingKm(path, sim.idx);
      const done = sim.idx >= path.length - 1;

      if (phase === 'to_pickup') {
        if (!sim.notifiedArriving && left < 1) {
          sim.notifiedArriving = true;
          await notifications.notify(res.ride.rider, { type: 'ride', title: 'Driver is arriving', body: 'Your driver is about a minute away.', ride: res.ride._id, link: `/ride/${rideId}` });
        }
        if (done) {
          stop(rideId);
          // eslint-disable-next-line global-require
          await require('./rideService').markArrived(rideId, driverId, { system: true });
        }
      } else if (done) {
        stop(rideId);
        await notifications.notify(res.ride.rider, { type: 'ride', title: 'You have reached your destination', body: 'Your driver will end the trip shortly.', ride: res.ride._id, link: `/ride/${rideId}` });
        await notifications.notify(driverId, { type: 'ride', title: 'Destination reached', body: 'Tap "Complete ride" to finish the trip.', ride: res.ride._id, link: '/driver' });
      }
    } catch (e) {
      logger.error('simulation tick failed', e.message);
      stop(rideId);
    }
  }, env.simulationTickMs);
  sims.set(rideId, sim);
}

/** Resume simulations for rides that were active when the server restarted. */
async function resumeActive() {
  if (!env.simulateDriverMovement) return;
  const rides = await Ride.find({ status: { $in: ['accepted', 'in_progress'] } }).select('_id status');
  await Promise.all(rides.map((r) => startLeg(String(r._id), r.status === 'accepted' ? 'to_pickup' : 'on_trip')));
  if (rides.length) logger.info(`Resumed tracking simulation for ${rides.length} active ride(s)`);
}

const stopAll = () => [...sims.keys()].forEach(stop);

module.exports = { reportDriverLocation, startLeg, stop, stopAll, resumeActive };
