const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['queued', 'paid', 'failed'], default: 'queued' },
    provider: String,
    providerRef: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model('Payout', payoutSchema);
