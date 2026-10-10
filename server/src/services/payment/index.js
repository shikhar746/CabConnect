const env = require('../../config/env');

const providers = {
  mock: () => require('./mockPaymentProvider'),
  stripe: () => require('./stripePaymentProvider'),
};

if (!providers[env.paymentProvider]) throw new Error(`Unknown PAYMENT_PROVIDER "${env.paymentProvider}"`);

module.exports = providers[env.paymentProvider]();
