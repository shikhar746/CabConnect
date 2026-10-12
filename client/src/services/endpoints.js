import { http } from './api';

/** Every backend endpoint the UI uses, in one place. */
export const AuthAPI = {
  config: () => http.get('/config'),
  login: (body) => http.post('/auth/login', body),
  register: (body) => http.post('/auth/register', body),
  social: (body) => http.post('/auth/social', body),
  me: () => http.get('/auth/me'),
  changePassword: (body) => http.post('/auth/change-password', body),
};

export const ProfileAPI = {
  update: (body) => http.patch('/users/me', body),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return http.post('/users/me/avatar', fd);
  },
  removeAvatar: () => http.delete('/users/me/avatar'),
  updateVehicle: (body) => http.put('/users/me/vehicle', body),
  addPaymentMethod: (body) => http.post('/users/me/payment-methods', body),
  removePaymentMethod: (id) => http.delete(`/users/me/payment-methods/${id}`),
  setDefaultPaymentMethod: (id) => http.patch(`/users/me/payment-methods/${id}/default`),
  addContact: (body) => http.post('/users/me/emergency-contacts', body),
  removeContact: (id) => http.delete(`/users/me/emergency-contacts/${id}`),
  topUp: (body) => http.post('/users/me/wallet/top-up', body),
};

export const MapsAPI = {
  search: (q, near) => http.get('/maps/search', { q, ...(near && { lat: near.lat, lng: near.lng }) }),
  reverse: ({ lat, lng }) => http.get('/maps/reverse', { lat, lng }),
};

export const RideAPI = {
  types: () => http.get('/rides/types'),
  estimate: (body) => http.post('/rides/estimate', body),
  create: (body) => http.post('/rides', body),
  list: (params) => http.get('/rides', params),
  active: () => http.get('/rides/active'),
  get: (id) => http.get(`/rides/${id}`),
  cancel: (id, reason) => http.post(`/rides/${id}/cancel`, { reason }),
  pay: (id, body) => http.post(`/rides/${id}/pay`, body),
  review: (id, body) => http.post(`/rides/${id}/review`, body),
  sos: (id, body) => http.post(`/rides/${id}/sos`, body),
  emailReceipt: (id) => http.post(`/rides/${id}/receipt/email`),
};

export const DriverAPI = {
  setStatus: (body) => http.patch('/driver/status', body),
  location: (body) => http.post('/driver/location', body),
  requests: () => http.get('/driver/requests'),
  accept: (id) => http.post(`/driver/rides/${id}/accept`),
  decline: (id) => http.post(`/driver/rides/${id}/decline`),
  arrive: (id) => http.post(`/driver/rides/${id}/arrive`),
  start: (id, otp) => http.post(`/driver/rides/${id}/start`, { otp }),
  complete: (id) => http.post(`/driver/rides/${id}/complete`),
  earnings: () => http.get('/driver/earnings'),
  payout: () => http.post('/driver/payouts'),
  reviews: (params) => http.get('/driver/reviews', params),
  profile: (id) => http.get(`/drivers/${id}`),
};

export const PromoAPI = {
  list: () => http.get('/promos'),
  validate: (body) => http.post('/promos/validate', body),
};

export const NotificationAPI = {
  list: (params) => http.get('/notifications', params),
  read: (id) => http.patch(`/notifications/${id}/read`),
  readAll: () => http.patch('/notifications/read-all'),
};

export const SupportAPI = {
  list: (params) => http.get('/support/tickets', params),
  get: (id) => http.get(`/support/tickets/${id}`),
  create: (body) => http.post('/support/tickets', body),
  message: (id, body) => http.post(`/support/tickets/${id}/messages`, { body }),
  update: (id, body) => http.patch(`/support/tickets/${id}`, body),
};

export const AdminAPI = {
  stats: () => http.get('/admin/stats'),
  users: (params) => http.get('/admin/users', params),
  updateUser: (id, body) => http.patch(`/admin/users/${id}`, body),
  rides: (params) => http.get('/admin/rides', params),
  payments: (params) => http.get('/admin/payments', params),
  promos: () => http.get('/admin/promos'),
  createPromo: (body) => http.post('/admin/promos', body),
  updatePromo: (id, body) => http.put(`/admin/promos/${id}`, body),
  deletePromo: (id) => http.delete(`/admin/promos/${id}`),
  sos: (params) => http.get('/admin/sos', params),
  resolveSos: (id, body) => http.patch(`/admin/sos/${id}`, body),
  outbox: (params) => http.get('/admin/outbox', params),
};
