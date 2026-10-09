const mongoose = require('mongoose');
const { TICKET_CATEGORIES } = require('../config/constants');

const messageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['rider', 'driver', 'admin'] },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

const ticketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    messages: [messageSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model('SupportTicket', ticketSchema);
