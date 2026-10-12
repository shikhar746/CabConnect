/**
 * Test harness: boots an isolated MongoDB (mongodb-memory-server, or TEST_MONGODB_URI
 * if provided), builds the Express app and seeds the demo dataset.
 */
process.env.NODE_ENV = 'test';
process.env.SIMULATE_DRIVER_MOVEMENT = 'false';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.MAPS_PROVIDER = 'mock';
process.env.EMAIL_PROVIDER = 'mock';
process.env.SMS_PROVIDER = 'mock';
process.env.SOCIAL_AUTH_PROVIDER = 'mock';

const mongoose = require('mongoose');
const request = require('supertest');

let mem;

async function setup() {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mem = await MongoMemoryServer.create();
    uri = mem.getUri('cabconnect_test');
  }
  await mongoose.connect(uri);
  const { User } = require('../src/models');
  await User.syncIndexes();
  const { seed } = require('../src/seed/seed');
  await seed({ quiet: true });
  const app = require('../src/app')();
  return request(app);
}

async function teardown() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mem) await mem.stop();
}

async function login(api, identifier, password = 'Password@123') {
  const res = await api.post('/api/auth/login').send({ identifier, password });
  if (res.status !== 200) throw new Error(`login failed for ${identifier}: ${JSON.stringify(res.body)}`);
  return { token: res.body.data.token, user: res.body.data.user, auth: { Authorization: `Bearer ${res.body.data.token}` } };
}

module.exports = { setup, teardown, login };
