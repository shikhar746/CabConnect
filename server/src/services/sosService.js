const { Ride, User, SosAlert } = require('../models');
const { ApiError } = require('../utils/http');
const { sendSms } = require('./sms');
const notifications = require('./notificationService');
const sockets = require('../sockets');
const logger = require('../utils/logger');

/**
 * Emergency SOS: shares the live location with the user's emergency contacts
 * via SMS and alerts the ops/admin team in real time. Emergency-services
 * dispatch (e.g. India's 112 ERSS) has no public API, so it is simulated and logged.
 */
async function trigger(rideId, user, { lat, lng, message }) {
  const ride = await Ride.findById(rideId).populate('driver', 'name phone driver.vehicle');
  if (!ride) throw ApiError.notFound('Ride not found');
  const isRider = String(ride.rider) === String(user._id);
  const isDriver = ride.driver && String(ride.driver._id) === String(user._id);
  if (!isRider && !isDriver) throw ApiError.forbidden();
  if (!['accepted', 'arriving', 'in_progress'].includes(ride.status)) throw ApiError.badRequest('SOS is available during an active ride');

  const location = (typeof lat === 'number' && typeof lng === 'number') ? { lat, lng } : (ride.driverLocation?.lat ? ride.driverLocation : ride.pickup);
  const me = await User.findById(user._id);
  const mapsLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;
  const v = ride.driver?.driver?.vehicle;
  const body = `SOS from ${me.name} (CabConnect). Live location: ${mapsLink}. ${v ? `Vehicle: ${v.color || ''} ${v.make || ''} ${v.model || ''} ${v.plate || ''}.` : ''} ${message || ''}`.trim();

  const contactsNotified = [];
  for (const c of me.emergencyContacts) {
    // eslint-disable-next-line no-await-in-loop
    const res = await sendSms({ to: c.phone, body });
    contactsNotified.push({ name: c.name, phone: c.phone, deliveryStatus: res.status });
  }
  logger.warn(`[mock-112] Emergency dispatch simulated for ride ${rideId} at ${location.lat},${location.lng}`);

  const alert = await SosAlert.create({ user: user._id, ride: ride._id, location, message, contactsNotified, emergencyServicesNotified: true });
  const payload = { ...alert.toJSON(), user: { _id: me._id, name: me.name, phone: me.phone } };
  sockets.emitToAdmins('sos:new', payload);
  await notifications.notifyAdmins({ type: 'sos', title: `🚨 SOS from ${me.name}`, body: `Ride ${String(ride._id).slice(-6)} · ${mapsLink}`, ride: ride._id, link: '/admin/sos' });
  return alert;
}

async function resolve(alertId, admin, { status, resolutionNote }) {
  const alert = await SosAlert.findById(alertId);
  if (!alert) throw ApiError.notFound('Alert not found');
  alert.status = status;
  alert.resolutionNote = resolutionNote;
  alert.resolvedBy = admin._id;
  await alert.save();
  await notifications.notify(alert.user, { type: 'sos', title: status === 'resolved' ? 'SOS resolved' : 'SOS acknowledged', body: resolutionNote || 'Our safety team is on it.', ride: alert.ride });
  return alert;
}

module.exports = { trigger, resolve };
