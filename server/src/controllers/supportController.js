const { SupportTicket, Ride } = require('../models');
const { ApiError, ok, created, asyncHandler, paginate, pageMeta, escapeRegex } = require('../utils/http');
const notifications = require('../services/notificationService');

const POP = [{ path: 'user', select: 'name email phone role' }, { path: 'messages.author', select: 'name role' }, { path: 'ride', select: 'pickup dropoff status fare createdAt' }];

async function loadOwned(id, user) {
  const t = await SupportTicket.findById(id).populate(POP);
  if (!t) throw ApiError.notFound('Ticket not found');
  if (user.role !== 'admin' && String(t.user._id) !== String(user._id)) throw ApiError.forbidden();
  return t;
}

exports.create = asyncHandler(async (req, res) => {
  const { category, subject, message, rideId } = req.body;
  if (rideId) {
    const ride = await Ride.findById(rideId).select('rider driver');
    if (!ride || (String(ride.rider) !== String(req.user._id) && String(ride.driver) !== String(req.user._id))) throw ApiError.badRequest('Linked ride not found');
  }
  const priority = ['safety', 'payment'].includes(category) ? 'high' : 'medium';
  const ticket = await SupportTicket.create({
    user: req.user._id, ride: rideId, category, subject, priority,
    messages: [{ author: req.user._id, authorRole: req.user.role, body: message }],
  });
  await notifications.notifyAdmins({ type: 'support', title: `New ${category.replace('_', ' ')} ticket`, body: subject, link: `/admin/support/${ticket._id}` });
  await notifications.notify(req.user._id, { type: 'support', title: 'Ticket received', body: `We've received “${subject}”. Our team usually replies within a few hours.`, link: `/support/${ticket._id}` });
  created(res, await SupportTicket.findById(ticket._id).populate(POP));
});

exports.list = asyncHandler(async (req, res) => {
  const p = paginate(req.query);
  const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.q) filter.subject = new RegExp(escapeRegex(req.query.q), 'i');
  const [items, total] = await Promise.all([
    SupportTicket.find(filter).sort({ updatedAt: -1 }).skip(p.skip).limit(p.limit).populate('user', 'name email role').lean(),
    SupportTicket.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(total, p));
});

exports.get = asyncHandler(async (req, res) => ok(res, await loadOwned(req.params.id, req.user)));

exports.addMessage = asyncHandler(async (req, res) => {
  const t = await loadOwned(req.params.id, req.user);
  if (t.status === 'closed') throw ApiError.badRequest('This ticket is closed. Please open a new one.');
  t.messages.push({ author: req.user._id, authorRole: req.user.role, body: req.body.body });
  if (req.user.role === 'admin') {
    if (t.status === 'open') t.status = 'in_progress';
    await notifications.notify(t.user._id, { type: 'support', title: 'Support replied to your ticket', body: req.body.body.slice(0, 120), link: `/support/${t._id}` });
  } else if (t.status === 'resolved') {
    t.status = 'open'; // reopened by the user
  }
  await t.save();
  ok(res, await SupportTicket.findById(t._id).populate(POP));
});

exports.update = asyncHandler(async (req, res) => {
  const t = await SupportTicket.findById(req.params.id);
  if (!t) throw ApiError.notFound('Ticket not found');
  Object.assign(t, req.body);
  await t.save();
  if (req.body.status) {
    await notifications.notify(t.user, { type: 'support', title: `Ticket ${req.body.status.replace('_', ' ')}`, body: t.subject, link: `/support/${t._id}` });
  }
  ok(res, await SupportTicket.findById(t._id).populate(POP));
});
