const mongoose = require('mongoose');

/** Outbox record for every email/SMS the app sends (real or mocked) – handy for demos & auditing. */
const messageLogSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['email', 'sms'], required: true },
    provider: String,
    to: { type: String, required: true },
    subject: String,
    body: String,
    status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
    providerRef: String,
    error: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model('MessageLog', messageLogSchema);
