const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    kind: { type: String, enum: ['ride_fare', 'cancellation_fee', 'wallet_topup'], default: 'ride_fare' },
    status: { type: String, enum: ['pending', 'succeeded', 'failed', 'refunded'], default: 'pending', index: true },
    provider: { type: String, default: 'mock' },
    providerRef: String,
    failureReason: String,
    driverEarning: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    receiptNumber: { type: String, unique: true, sparse: true },
    receiptEmailedAt: Date,
  },
  { timestamps: true },
);

paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
