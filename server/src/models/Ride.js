const mongoose = require('mongoose');
const { RIDE_TYPES, RIDE_STATUS, PAYMENT_METHODS } = require('../config/constants');

const placeSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true, maxlength: 200 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

const fareSchema = new mongoose.Schema(
  {
    baseFare: Number,
    distanceFare: Number,
    timeFare: Number,
    stopsFare: Number,
    surgeMultiplier: { type: Number, default: 1 },
    subtotal: Number,
    discount: { type: Number, default: 0 },
    cancellationFee: { type: Number, default: 0 },
    total: Number,
    currency: { type: String, default: 'INR' },
  },
  { _id: false },
);

const rideSchema = new mongoose.Schema(
  {
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    pickup: { type: placeSchema, required: true },
    stops: { type: [placeSchema], validate: [(v) => v.length <= 3, 'Maximum 3 intermediate stops'] },
    dropoff: { type: placeSchema, required: true },
    rideType: { type: String, enum: Object.keys(RIDE_TYPES), required: true },
    status: { type: String, enum: RIDE_STATUS, default: 'requested', index: true },
    distanceKm: Number,
    durationMin: Number,
    route: [{ _id: false, lat: Number, lng: Number }],
    fare: fareSchema,
    promoCode: { type: String, uppercase: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    paymentMethodId: mongoose.Schema.Types.ObjectId,
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'not_required'], default: 'pending' },
    otp: { type: String, select: false },
    driverLocation: { _id: false, lat: Number, lng: Number },
    etaMin: Number,
    offeredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    cancelledBy: { type: String, enum: ['rider', 'driver', 'system'] },
    cancelReason: String,
    rated: { type: Boolean, default: false },
    timeline: {
      requestedAt: { type: Date, default: Date.now },
      acceptedAt: Date,
      arrivedAt: Date,
      startedAt: Date,
      completedAt: Date,
      cancelledAt: Date,
    },
  },
  { timestamps: true },
);

rideSchema.index({ rider: 1, createdAt: -1 });
rideSchema.index({ driver: 1, createdAt: -1 });
rideSchema.index({ status: 1, rideType: 1, createdAt: -1 });

rideSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Ride', rideSchema);
