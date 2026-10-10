const env = require('../../config/env');

/**
 * Real Stripe adapter. Activated with PAYMENT_PROVIDER=stripe and STRIPE_SECRET_KEY.
 * In this mode the client must tokenize cards with Stripe Elements and send the
 * resulting PaymentMethod id (pm_...) as `providerToken` – raw card numbers are rejected.
 * UPI/wallet flows are not offered by Stripe in India and fall back to the in-app wallet/cash.
 */
let stripe;
const client = () => {
  if (!stripe) {
    if (!env.stripeSecretKey || env.stripeSecretKey.startsWith('REPLACE')) throw new Error('STRIPE_SECRET_KEY is not configured');
    // eslint-disable-next-line global-require
    const Stripe = require('stripe');
    stripe = new Stripe(env.stripeSecretKey);
  }
  return stripe;
};

// Stripe expects the smallest currency unit (paise for INR).
const toMinor = (amount) => Math.round(amount * 100);

module.exports = {
  name: 'stripe',

  async tokenizeCard({ providerToken }) {
    if (!providerToken || !providerToken.startsWith('pm_')) {
      const err = new Error('A Stripe PaymentMethod id (pm_...) is required'); err.status = 400; throw err;
    }
    const pm = await client().paymentMethods.retrieve(providerToken);
    return { providerToken: pm.id, brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
  },

  async charge({ amount, currency, method, paymentMethod, metadata }) {
    if (method !== 'card') return { status: 'failed', failureReason: `Stripe adapter does not support ${method}` };
    try {
      const intent = await client().paymentIntents.create({
        amount: toMinor(amount),
        currency: (currency || env.currency).toLowerCase(),
        payment_method: paymentMethod.providerToken,
        confirm: true,
        off_session: true,
        metadata,
      });
      return { status: intent.status === 'succeeded' ? 'succeeded' : 'failed', providerRef: intent.id, failureReason: intent.last_payment_error?.message };
    } catch (e) {
      return { status: 'failed', providerRef: e.raw?.payment_intent?.id, failureReason: e.message };
    }
  },

  async refund({ providerRef, amount }) {
    const r = await client().refunds.create({ payment_intent: providerRef, amount: toMinor(amount) });
    return { status: 'refunded', providerRef: r.id, original: providerRef, amount };
  },

  async payout({ amount }) {
    // Real driver payouts require Stripe Connect accounts; documented in README.
    return { status: 'queued', amount };
  },
};
