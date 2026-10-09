const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

let memoryServer;

/**
 * Connects to MongoDB. When USE_IN_MEMORY_DB=true (dev fallback only) an
 * ephemeral mongod is started via mongodb-memory-server and data is lost on exit.
 */
async function connectDB() {
  let uri = env.mongoUri;
  if (env.useInMemoryDb) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('cabconnect');
    logger.warn('Using IN-MEMORY MongoDB (dev fallback). Data will not persist.');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  return { uri, inMemory: !!memoryServer };
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

module.exports = { connectDB, disconnectDB };
