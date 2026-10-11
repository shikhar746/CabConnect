const http = require('http');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const createApp = require('./app');
const sockets = require('./sockets');
const logger = require('./utils/logger');

async function start() {
  const { inMemory } = await connectDB();
  // eslint-disable-next-line global-require
  const { User } = require('./models');
  await User.syncIndexes(); // ensure the 2dsphere index exists before matching

  if (inMemory && !(await User.estimatedDocumentCount())) {
    // eslint-disable-next-line global-require
    await require('./seed/seed').seed({ quiet: true });
    logger.info('In-memory database seeded with demo data');
  }

  const app = createApp();
  const server = http.createServer(app);
  sockets.init(server);

  // eslint-disable-next-line global-require
  const tracking = require('./services/trackingService');
  // eslint-disable-next-line global-require
  const rideService = require('./services/rideService');
  await tracking.resumeActive();
  const sweeper = setInterval(() => rideService.expireStaleRequests().catch((e) => logger.error('sweeper', e.message)), 30000);

  server.listen(env.port, () => {
    logger.info(`CabConnect API listening on http://localhost:${env.port}/api`);
    logger.info(`Providers → payment:${env.paymentProvider} maps:${env.mapsProvider} email:${env.emailProvider} sms:${env.smsProvider} social:${env.socialAuthProvider}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    clearInterval(sweeper);
    tracking.stopAll();
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((e) => {
  logger.error('Failed to start server:', e.message);
  if (/ECONNREFUSED|ServerSelection/.test(e.message)) {
    logger.error('Is MongoDB running? Start it, set MONGODB_URI, or set USE_IN_MEMORY_DB=true for a throwaway dev database.');
  }
  process.exit(1);
});
