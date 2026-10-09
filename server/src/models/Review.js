const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, unique: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
    tags: [{ type: String, maxlength: 30 }],
  },
  { timestamps: true },
);

reviewSchema.index({ driver: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
