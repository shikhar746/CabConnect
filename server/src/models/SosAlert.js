const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    location: { _id: false, lat: Number, lng: Number },
    message: { type: String, maxlength: 300 },
    contactsNotified: [{ _id: false, name: String, phone: String, deliveryStatus: String }],
    emergencyServicesNotified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active', index: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model('SosAlert', sosSchema);
