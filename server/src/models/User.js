const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { RIDE_TYPES } = require('../config/constants');

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
  { _id: false },
);

const paymentMethodSchema = new mongoose.Schema({
  type: { type: String, enum: ['card', 'upi', 'wallet'], required: true },
  label: { type: String, trim: true, maxlength: 60 },
  // Card details are tokenized by the payment provider; only display data is stored.
  brand: String,
  last4: { type: String, match: /^\d{4}$/ },
  expMonth: { type: Number, min: 1, max: 12 },
  expYear: Number,
  upiId: { type: String, trim: true, lowercase: true },
  providerToken: { type: String, select: false },
  isDefault: { type: Boolean, default: false },
});

const emergencyContactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  phone: { type: String, required: true, trim: true },
  relation: { type: String, trim: true, maxlength: 30 },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Optional only for accounts created through social sign-in (they add it later).
    phone: { type: String, unique: true, sparse: true, trim: true, required() { return !this.socialProvider; } },
    socialProvider: { type: String, enum: ['google'] },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['rider', 'driver', 'admin'], default: 'rider', index: true },
    avatarUrl: String,
    isActive: { type: Boolean, default: true },
    walletBalance: { type: Number, default: 0, min: 0 },
    paymentMethods: [paymentMethodSchema],
    emergencyContacts: { type: [emergencyContactSchema], validate: [(v) => v.length <= 5, 'Max 5 emergency contacts'] },
    driver: {
      vehicle: {
        type: { type: String, enum: Object.keys(RIDE_TYPES) },
        make: String,
        model: String,
        color: String,
        plate: { type: String, uppercase: true, trim: true },
      },
      licenseNumber: String,
      isOnline: { type: Boolean, default: false },
      isBusy: { type: Boolean, default: false },
      location: { type: pointSchema, default: undefined },
      rating: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
      pendingPayout: { type: Number, default: 0 },
    },
    riderRating: { type: Number, default: 5 },
  },
  { timestamps: true },
);

userSchema.index({ 'driver.location': '2dsphere' }, { sparse: true });
userSchema.index({ role: 1, 'driver.isOnline': 1, 'driver.isBusy': 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.__v;
    // Provider tokens are server-side secrets; never serialize them.
    (ret.paymentMethods || []).forEach((p) => { delete p.providerToken; });
    // Partial selects (e.g. populate) may omit role; only strip driver data from known non-drivers.
    if (ret.role && ret.role !== 'driver') delete ret.driver;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
