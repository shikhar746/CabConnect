const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const bool = (v, fallback = false) => (v === undefined ? fallback : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cabconnect',
  useInMemoryDb: bool(process.env.USE_IN_MEMORY_DB),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Integration providers: "mock" (default, no credentials needed) or the real one.
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock', // mock | stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  mapsProvider: process.env.MAPS_PROVIDER || 'mock', // mock | google
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  socialAuthProvider: process.env.SOCIAL_AUTH_PROVIDER || 'mock', // mock | google
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  emailProvider: process.env.EMAIL_PROVIDER || 'mock', // mock | smtp
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'CabConnect <no-reply@cabconnect.local>',
  },
  smsProvider: process.env.SMS_PROVIDER || 'mock', // mock | twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM_NUMBER,
  },

  // Simulates the driver's GPS when no real driver device is streaming location.
  simulateDriverMovement: bool(process.env.SIMULATE_DRIVER_MOVEMENT, true),
  simulationTickMs: Number(process.env.SIMULATION_TICK_MS) || 2000,
  matchRadiusKm: Number(process.env.MATCH_RADIUS_KM) || 8,
  cancellationFreeWindowMin: Number(process.env.CANCELLATION_FREE_WINDOW_MIN) || 2,
  cancellationFee: Number(process.env.CANCELLATION_FEE) || 50,
  driverEarningShare: Number(process.env.DRIVER_EARNING_SHARE) || 0.8,
  currency: process.env.CURRENCY || 'INR',
};

env.isTest = env.nodeEnv === 'test';
env.isProd = env.nodeEnv === 'production';
// Login/register attempts per IP per 15 min. Local demos share one IP, so dev is more lenient.
env.authRateLimit = Number(process.env.AUTH_RATE_LIMIT) || (env.isProd ? 30 : 200);

if (env.isProd && env.jwtSecret.startsWith('dev-only')) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
