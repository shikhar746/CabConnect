const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../utils/logger');
const { User, Ride } = require('../models');

/**
 * Real-time layer (Socket.IO). Rooms:
 *   user:<id>   – every socket of a user (notifications, ride updates)
 *   ride:<id>   – live location/status for a ride
 *   admins      – SOS alerts & ops events
 */
let io;

function init(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientUrl.split(','), credentials: true } });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub).select('role name isActive');
      if (!user || !user.isActive) return next(new Error('Account not found'));
      socket.user = { id: String(user._id), role: user.role, name: user.name };
      return next();
    } catch (e) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    socket.join(`user:${id}`);
    if (role === 'admin') socket.join('admins');

    socket.on('ride:join', async (rideId, ack) => {
      try {
        const ride = await Ride.findById(rideId).select('rider driver');
        const allowed = ride && (role === 'admin' || String(ride.rider) === id || String(ride.driver) === id);
        if (allowed) socket.join(`ride:${rideId}`);
        ack?.({ ok: !!allowed });
      } catch {
        ack?.({ ok: false });
      }
    });
    socket.on('ride:leave', (rideId) => socket.leave(`ride:${rideId}`));

    // A real driver device streams GPS here; the server relays it to the rider.
    socket.on('driver:location', async ({ rideId, lat, lng } = {}) => {
      if (role !== 'driver' || typeof lat !== 'number' || typeof lng !== 'number') return;
      // eslint-disable-next-line global-require
      const tracking = require('../services/trackingService');
      await tracking.reportDriverLocation(id, { lat, lng }, rideId);
    });

    socket.on('disconnect', () => logger.info(`socket disconnected ${role}:${id}`));
  });

  return io;
}

const emitToUser = (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload);
const emitToRide = (rideId, event, payload) => io?.to(`ride:${rideId}`).emit(event, payload);
const emitToAdmins = (event, payload) => io?.to('admins').emit(event, payload);

module.exports = { init, emitToUser, emitToRide, emitToAdmins, getIO: () => io };
