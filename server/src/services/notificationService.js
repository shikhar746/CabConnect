const { Notification, User } = require('../models');
const sockets = require('../sockets');

async function notify(userId, { type = 'system', title, body, ride, link }) {
  const n = await Notification.create({ user: userId, type, title, body, ride, link });
  sockets.emitToUser(String(userId), 'notification:new', n.toJSON());
  return n;
}

async function notifyAdmins(payload) {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await Promise.all(admins.map((a) => notify(a._id, payload)));
}

module.exports = { notify, notifyAdmins };
