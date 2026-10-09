const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9]{3,20}$/ },
    description: { type: String, trim: true, maxlength: 200 },
    discountType: { type: String, enum: ['percent', 'flat'], required: true },
    value: { type: Number, required: true, min: 1 },
    maxDiscount: { type: Number, min: 0 }, // cap for percent discounts
    minFare: { type: Number, default: 0, min: 0 },
    expiresAt: Date,
    usageLimit: { type: Number, min: 1 }, // global
    perUserLimit: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0 },
    usedBy: [{ _id: false, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, count: Number }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

promoSchema.pre('validate', function capPercent(next) {
  if (this.discountType === 'percent' && this.value > 100) this.invalidate('value', 'Percent discount cannot exceed 100');
  next();
});

module.exports = mongoose.model('PromoCode', promoSchema);
