const crypto = require('crypto');
const env = require('../config/env');
const { Ride, User, Payment, Payout } = require('../models');
const { ApiError } = require('../utils/http');
const { round } = require('../utils/geo');
const gateway = require('./payment');
const notifications = require('./notificationService');
const { sendEmail } = require('./email');
const { buildReceiptPdf } = require('./receiptService');

const receiptNo = () => `CC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const amountDue = (ride) => (ride.status === 'cancelled' ? ride.fare.cancellationFee : ride.fare.total);

async function creditDriver(driverId, amount, { inApp }) {
  const earning = round(amount * env.driverEarningShare, 2);
  await User.updateOne({ _id: driverId }, { $inc: { 'driver.totalEarnings': earning, ...(inApp && { 'driver.pendingPayout': earning }) } });
  return earning;
}

async function emailReceipt(rideId) {
  const ride = await Ride.findById(rideId).populate([{ path: 'rider', select: 'name email' }, { path: 'driver', select: 'name driver.vehicle' }]);
  const payment = await Payment.findOne({ ride: rideId, status: 'succeeded' }).sort({ createdAt: -1 });
  if (!ride || !payment) throw ApiError.notFound('No completed payment for this ride');
  const pdf = await buildReceiptPdf(ride, payment);
  const res = await sendEmail({
    to: ride.rider.email,
    subject: `Your CabConnect receipt ${payment.receiptNumber}`,
    text: `Hi ${ride.rider.name}, thanks for riding with CabConnect. You paid ₹${payment.amount} for your trip from ${ride.pickup.address} to ${ride.dropoff.address}. Your receipt is attached.`,
    html: `<p>Hi ${ride.rider.name},</p><p>Thanks for riding with CabConnect. You paid <b>₹${payment.amount}</b> for your trip from <b>${ride.pickup.address}</b> to <b>${ride.dropoff.address}</b>.</p><p>Your receipt is attached.</p>`,
    attachments: [{ filename: `${payment.receiptNumber}.pdf`, content: pdf }],
  });
  if (res.status === 'sent') {
    payment.receiptEmailedAt = new Date();
    await payment.save();
  }
  return res;
}

async function onSuccess(ride, payment) {
  ride.paymentStatus = 'paid';
  await ride.save();
  if (ride.driver && payment.kind === 'ride_fare') {
    payment.driverEarning = await creditDriver(ride.driver, payment.amount, { inApp: payment.method !== 'cash' });
    payment.platformFee = round(payment.amount - payment.driverEarning, 2);
    await payment.save();
    await notifications.notify(ride.driver, { type: 'payment', title: `You earned ₹${payment.driverEarning}`, body: `Trip payment received via ${payment.method.toUpperCase()}.`, ride: ride._id, link: '/driver/earnings' });
  }
  await notifications.notify(ride.rider, { type: 'payment', title: 'Payment successful', body: `₹${payment.amount} paid. Receipt ${payment.receiptNumber} sent to your email.`, ride: ride._id, link: '/history' });
  await emailReceipt(ride._id).catch(() => null);
}

/** Pay the fare (or the cancellation fee) for a ride. */
async function payRide(rideId, rider, { method, paymentMethodId }) {
  const ride = await Ride.findById(rideId);
  if (!ride || String(ride.rider) !== String(rider._id)) throw ApiError.notFound('Ride not found');
  if (!['completed', 'cancelled'].includes(ride.status)) throw ApiError.conflict('Payment is collected after the ride ends');
  if (ride.paymentStatus === 'paid') throw ApiError.conflict('This ride is already paid');
  if (ride.paymentStatus === 'not_required') throw ApiError.badRequest('Nothing to pay for this ride');

  const amount = amountDue(ride);
  const chosen = method || ride.paymentMethod;
  const kind = ride.status === 'cancelled' ? 'cancellation_fee' : 'ride_fare';
  if (kind === 'cancellation_fee' && chosen === 'cash') throw ApiError.badRequest('Cancellation fees must be paid in-app');
  let pm;
  if (['card', 'upi'].includes(chosen)) {
    const user = await User.findById(rider._id).select('+paymentMethods.providerToken');
    pm = user.paymentMethods.id(paymentMethodId || ride.paymentMethodId);
    if (!pm || pm.type !== chosen) throw ApiError.badRequest(`Choose a saved ${chosen === 'card' ? 'card' : 'UPI ID'}`);
  }

  const payment = new Payment({ ride: ride._id, rider: rider._id, driver: ride.driver, amount, method: chosen, kind, provider: chosen === 'wallet' || chosen === 'cash' ? 'internal' : gateway.name });

  if (chosen === 'wallet') {
    // Atomic debit – fails if the balance is insufficient.
    const debited = await User.findOneAndUpdate({ _id: rider._id, walletBalance: { $gte: amount } }, { $inc: { walletBalance: -amount } }, { new: true });
    if (!debited) {
      payment.status = 'failed';
      payment.failureReason = 'Insufficient wallet balance';
    } else {
      payment.status = 'succeeded';
      payment.providerRef = `wallet_${crypto.randomBytes(6).toString('hex')}`;
    }
  } else if (chosen === 'cash') {
    payment.status = 'succeeded';
    payment.providerRef = 'cash_collected';
  } else {
    const result = await gateway.charge({ amount, currency: env.currency, method: chosen, paymentMethod: pm, metadata: { rideId: String(ride._id) } });
    payment.status = result.status === 'succeeded' ? 'succeeded' : 'failed';
    payment.providerRef = result.providerRef;
    payment.failureReason = result.failureReason;
  }

  if (payment.status === 'succeeded') payment.receiptNumber = receiptNo();
  await payment.save();

  if (payment.status === 'failed') {
    ride.paymentStatus = 'failed';
    await ride.save();
    await notifications.notify(rider._id, { type: 'payment', title: 'Payment failed', body: payment.failureReason, ride: ride._id, link: `/ride/${ride._id}` });
    throw ApiError.badRequest(payment.failureReason || 'Payment failed', { paymentId: payment._id });
  }
  ride.paymentMethod = chosen;
  await onSuccess(ride, payment);
  return payment;
}

/** Called on completion of a cash ride: the driver collected the fare. */
async function recordCashPayment(ride) {
  const payment = await Payment.create({
    ride: ride._id, rider: ride.rider, driver: ride.driver, amount: ride.fare.total, method: 'cash',
    status: 'succeeded', provider: 'internal', providerRef: 'cash_collected', receiptNumber: receiptNo(),
  });
  await onSuccess(ride, payment);
  return payment;
}

async function topUpWallet(user, { amount, paymentMethodId }) {
  const full = await User.findById(user._id).select('+paymentMethods.providerToken');
  const pm = full.paymentMethods.id(paymentMethodId);
  if (!pm || !['card', 'upi'].includes(pm.type)) throw ApiError.badRequest('Choose a saved card or UPI ID');
  const result = await gateway.charge({ amount, currency: env.currency, method: pm.type, paymentMethod: pm, metadata: { purpose: 'wallet_topup' } });
  if (result.status !== 'succeeded') throw ApiError.badRequest(result.failureReason || 'Top-up failed');
  const updated = await User.findByIdAndUpdate(user._id, { $inc: { walletBalance: amount } }, { new: true });
  await notifications.notify(user._id, { type: 'payment', title: 'Wallet topped up', body: `₹${amount} added. New balance ₹${updated.walletBalance}.`, link: '/profile' });
  return { walletBalance: updated.walletBalance, providerRef: result.providerRef };
}

async function requestPayout(driver) {
  const fresh = await User.findById(driver._id);
  const amount = round(fresh.driver?.pendingPayout || 0, 2);
  if (amount < 1) throw ApiError.badRequest('No earnings available for payout');
  const res = await gateway.payout({ amount, driverId: String(driver._id) });
  const payout = await Payout.create({ driver: driver._id, amount, status: res.status === 'paid' ? 'paid' : 'queued', provider: gateway.name, providerRef: res.providerRef });
  await User.updateOne({ _id: driver._id }, { $inc: { 'driver.pendingPayout': -amount } });
  await notifications.notify(driver._id, { type: 'payment', title: 'Payout initiated', body: `₹${amount} is on its way to your bank account.`, link: '/driver/earnings' });
  return payout;
}

module.exports = { payRide, recordCashPayment, topUpWallet, requestPayout, emailReceipt, amountDue };
