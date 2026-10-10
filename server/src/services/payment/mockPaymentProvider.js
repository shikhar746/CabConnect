const crypto = require('crypto');
const env = require('../../config/env');

/**
 * Mock payment gateway that mirrors the shape of the Stripe adapter.
 * Deterministic test behaviour (borrowed from Stripe's test cards):
 *   - card ending 0002  -> declined
 *   - card ending 9995  -> insufficient funds
 *   - UPI id containing "fail" -> failed
 *   - everything else succeeds
 */
const delay = (ms) => new Promise((r) => setTimeout(r, env.isTest ? 0 : ms));
const ref = (prefix) => `${prefix}_mock_${crypto.randomBytes(8).toString('hex')}`;

function luhnValid(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function detectBrand(num) {
  if (/^4/.test(num)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'mastercard';
  if (/^3[47]/.test(num)) return 'amex';
  if (/^(60|65|81|82)/.test(num)) return 'rupay';
  return 'card';
}

module.exports = {
  name: 'mock',

  /** Tokenize a card. Accepts a raw test card number (mock only – never do this in production). */
  async tokenizeCard({ cardNumber, expMonth, expYear }) {
    const num = String(cardNumber || '').replace(/\s+/g, '');
    if (!/^\d{12,19}$/.test(num) || !luhnValid(num)) {
      const err = new Error('Card number is invalid'); err.status = 400; throw err;
    }
    const now = new Date();
    if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
      const err = new Error('Card has expired'); err.status = 400; throw err;
    }
    await delay(300);
    return { providerToken: ref('pm'), brand: detectBrand(num), last4: num.slice(-4), expMonth, expYear };
  },

  async charge({ amount, method, paymentMethod }) {
    await delay(700);
    if (method === 'card') {
      if (paymentMethod?.last4 === '0002') return { status: 'failed', providerRef: ref('pi'), failureReason: 'Your card was declined.' };
      if (paymentMethod?.last4 === '9995') return { status: 'failed', providerRef: ref('pi'), failureReason: 'Insufficient funds.' };
    }
    if (method === 'upi' && /fail/i.test(paymentMethod?.upiId || '')) {
      return { status: 'failed', providerRef: ref('upi'), failureReason: 'UPI collect request was declined.' };
    }
    return { status: 'succeeded', providerRef: ref(method === 'upi' ? 'upi' : 'pi'), amount };
  },

  async refund({ providerRef, amount }) {
    await delay(300);
    return { status: 'refunded', providerRef: ref('re'), original: providerRef, amount };
  },

  /** Simulated payout to a driver's bank account. */
  async payout({ amount }) {
    await delay(300);
    return { status: 'paid', providerRef: ref('po'), amount };
  },
};
