const { setup, teardown, login } = require('./setup');
const { Ride, User, MessageLog } = require('../src/models');

let api; let rider; let driver; let admin;
const MG_ROAD = { address: 'MG Road Metro Station, MG Road', lat: 12.9756, lng: 77.6066 };
const KORAMANGALA = { address: 'Koramangala 5th Block, Koramangala', lat: 12.9352, lng: 77.6245 };
const CUBBON = { address: 'Cubbon Park, Kasturba Road', lat: 12.9763, lng: 77.5929 };

beforeAll(async () => {
  api = await setup();
  rider = await login(api, 'rider@cabconnect.dev');
  driver = await login(api, 'driver@cabconnect.dev'); // online "mini" driver near MG Road
  admin = await login(api, 'admin@cabconnect.dev');
});
afterAll(teardown);

describe('fare estimation & promos', () => {
  test('returns an option per ride type with a fare breakdown', async () => {
    const res = await api.post('/api/rides/estimate').set(rider.auth).send({ pickup: MG_ROAD, dropoff: KORAMANGALA });
    expect(res.status).toBe(200);
    expect(res.body.data.options.map((o) => o.rideType)).toEqual(['bike', 'auto', 'mini', 'sedan', 'suv']);
    const mini = res.body.data.options.find((o) => o.rideType === 'mini');
    expect(mini.fare.total).toBeGreaterThanOrEqual(80);
    expect(res.body.data.path.length).toBeGreaterThan(2);
  });

  test('multi-stop rides cost more and include a stop fee', async () => {
    const direct = await api.post('/api/rides/estimate').set(rider.auth).send({ pickup: MG_ROAD, dropoff: KORAMANGALA });
    const multi = await api.post('/api/rides/estimate').set(rider.auth).send({ pickup: MG_ROAD, stops: [CUBBON], dropoff: KORAMANGALA });
    const f = (r) => r.body.data.options.find((o) => o.rideType === 'sedan').fare;
    expect(f(multi).stopsFare).toBe(15);
    expect(f(multi).subtotal).toBeGreaterThan(f(direct).subtotal);
  });

  test('applies valid promos and reports invalid/expired ones', async () => {
    const good = await api.post('/api/rides/estimate').set(rider.auth).send({ pickup: MG_ROAD, dropoff: KORAMANGALA, promoCode: 'welcome50' });
    const mini = good.body.data.options.find((o) => o.rideType === 'mini');
    expect(mini.fare.discount).toBeGreaterThan(0);
    expect(mini.fare.total).toBe(mini.fare.subtotal - mini.fare.discount);
    const expired = await api.post('/api/rides/estimate').set(rider.auth).send({ pickup: MG_ROAD, dropoff: KORAMANGALA, promoCode: 'MONSOON' });
    expect(expired.body.data.promo).toMatchObject({ valid: false, error: 'Promo code has expired' });
  });

  test('a minimum-fare promo applies per ride type, not all-or-nothing', async () => {
    const res = await api.post('/api/rides/estimate').set(rider.auth).send({ pickup: MG_ROAD, dropoff: KORAMANGALA, promoCode: 'RIDE20' });
    const byType = Object.fromEntries(res.body.data.options.map((o) => [o.rideType, o]));
    expect(res.body.data.promo.valid).toBe(true);
    expect(byType.bike.promoError).toMatch(/minimum fare/);
    expect(byType.sedan.fare.discount).toBeGreaterThan(0);
  });

  test('an estimate looks up the promo once, not once per ride type', async () => {
    const { PromoCode } = require('../src/models');
    const spy = jest.spyOn(PromoCode, 'findOne');
    await api.post('/api/rides/estimate').set(rider.auth).send({ pickup: MG_ROAD, dropoff: KORAMANGALA, promoCode: 'RIDE20' });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  test('maxDiscount never caps a flat promo', async () => {
    const { PromoCode } = require('../src/models');
    await PromoCode.create({ code: 'FLATCAP', discountType: 'flat', value: 40, maxDiscount: 10 });
    const res = await api.post('/api/promos/validate').set(rider.auth).send({ code: 'FLATCAP', subtotal: 200 });
    expect(res.body.data.discount).toBe(40);
  });
});

describe('full ride lifecycle', () => {
  let rideId; let otp;

  test('rider books a ride and nearby drivers are notified', async () => {
    const res = await api.post('/api/rides').set(rider.auth).send({ pickup: MG_ROAD, dropoff: KORAMANGALA, rideType: 'mini', paymentMethod: 'card', paymentMethodId: rider.user.paymentMethods[0]._id, promoCode: 'WELCOME50' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('requested');
    expect(res.body.data.otp).toMatch(/^\d{4}$/);
    expect(res.body.data.driversNotified).toBeGreaterThanOrEqual(1);
    rideId = res.body.data._id;
    otp = res.body.data.otp;
  });

  test('a rider cannot book a second ride while one is active', async () => {
    const res = await api.post('/api/rides').set(rider.auth).send({ pickup: MG_ROAD, dropoff: KORAMANGALA, rideType: 'mini' });
    expect(res.status).toBe(409);
  });

  test('driver sees the request, accepts it; a second accept fails', async () => {
    const reqs = await api.get('/api/driver/requests').set(driver.auth);
    expect(reqs.body.data.map((r) => r._id)).toContain(rideId);
    const acc = await api.post(`/api/driver/rides/${rideId}/accept`).set(driver.auth);
    expect(acc.status).toBe(200);
    expect(acc.body.data.status).toBe('accepted');
    expect(acc.body.data.driver.name).toBe('Ramesh Kumar');
    expect(acc.body.data.driver.driver.vehicle.plate).toBe('KA01AB1234');
    expect(acc.body.data.driver.driver.rating).toBeGreaterThan(0);
    const other = await login(api, 'lakshmi@cabconnect.dev');
    expect((await api.post(`/api/driver/rides/${rideId}/accept`).set(other.auth)).status).toBe(409);
  });

  test('driver PIN is hidden from the driver and required to start', async () => {
    const asDriver = await api.get(`/api/rides/${rideId}`).set(driver.auth);
    expect(asDriver.body.data.otp).toBeUndefined();
    await api.post(`/api/driver/rides/${rideId}/arrive`).set(driver.auth).expect(200);
    const wrong = await api.post(`/api/driver/rides/${rideId}/start`).set(driver.auth).send({ otp: otp === '1111' ? '2222' : '1111' });
    expect(wrong.status).toBe(400);
    const start = await api.post(`/api/driver/rides/${rideId}/start`).set(driver.auth).send({ otp });
    expect(start.body.data.status).toBe('in_progress');
  });

  test('SOS during the ride notifies emergency contacts and admins', async () => {
    const res = await api.post(`/api/rides/${rideId}/sos`).set(rider.auth).send({ lat: 12.95, lng: 77.61, message: 'Test alert' });
    expect(res.status).toBe(201);
    expect(res.body.data.contactsNotified).toHaveLength(2);
    expect(await MessageLog.countDocuments({ channel: 'sms' })).toBe(2);
    const list = await api.get('/api/admin/sos?status=active').set(admin.auth);
    expect(list.body.data[0]._id).toBe(res.body.data._id);
    const resolved = await api.patch(`/api/admin/sos/${res.body.data._id}`).set(admin.auth).send({ status: 'resolved', resolutionNote: 'Test resolved' });
    expect(resolved.body.data.status).toBe('resolved');
  });

  test('driver completes; declined card fails, good card succeeds and receipt is emailed', async () => {
    const done = await api.post(`/api/driver/rides/${rideId}/complete`).set(driver.auth);
    expect(done.body.data.status).toBe('completed');
    expect(done.body.data.paymentStatus).toBe('pending');

    const declined = await api.post(`/api/rides/${rideId}/pay`).set(rider.auth).send({ method: 'card', paymentMethodId: rider.user.paymentMethods[1]._id });
    expect(declined.status).toBe(400);
    expect(declined.body.error.message).toMatch(/declined/);

    const before = (await User.findById(driver.user._id)).driver.totalEarnings;
    const paid = await api.post(`/api/rides/${rideId}/pay`).set(rider.auth).send({ method: 'card', paymentMethodId: rider.user.paymentMethods[0]._id });
    expect(paid.status).toBe(200);
    expect(paid.body.data.payment.status).toBe('succeeded');
    expect(paid.body.data.ride.paymentStatus).toBe('paid');
    const after = (await User.findById(driver.user._id)).driver;
    expect(after.totalEarnings).toBeGreaterThan(before);
    expect(after.isBusy).toBe(false);
    expect(await MessageLog.countDocuments({ channel: 'email', subject: /receipt/ })).toBe(1);

    expect((await api.post(`/api/rides/${rideId}/pay`).set(rider.auth).send({})).status).toBe(409);
  });

  test('receipt PDF downloads', async () => {
    const res = await api.get(`/api/rides/${rideId}/receipt`).set(rider.auth).buffer(true).parse((r, cb) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });

  test('rider rates the driver once and the average updates', async () => {
    const before = (await User.findById(driver.user._id)).driver;
    const res = await api.post(`/api/rides/${rideId}/review`).set(rider.auth).send({ rating: 5, comment: 'Great ride', tags: ['Safe driving'] });
    expect(res.status).toBe(201);
    const after = (await User.findById(driver.user._id)).driver;
    expect(after.ratingCount).toBe(before.ratingCount + 1);
    expect((await api.post(`/api/rides/${rideId}/review`).set(rider.auth).send({ rating: 4 })).status).toBe(409);
    const profile = await api.get(`/api/drivers/${driver.user._id}`).set(rider.auth);
    expect(profile.body.data.reviews[0].comment).toBe('Great ride');
  });

  test('the promo cannot be reused (per-user limit 1)', async () => {
    const res = await api.post('/api/promos/validate').set(rider.auth).send({ code: 'WELCOME50', subtotal: 300 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/already used/);
  });

  test('ride history paginates and filters', async () => {
    const res = await api.get('/api/rides?status=completed&limit=5&page=1').set(rider.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.data.every((r) => r.status === 'completed')).toBe(true);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });
});

describe('cancellation', () => {
  test('cancelling before a driver accepts is free', async () => {
    const created = await api.post('/api/rides').set(rider.auth).send({ pickup: MG_ROAD, dropoff: CUBBON, rideType: 'sedan' });
    const res = await api.post(`/api/rides/${created.body.data._id}/cancel`).set(rider.auth).send({ reason: 'Plans changed' });
    expect(res.status).toBe(200);
    expect(res.body.data.cancellationFee).toBe(0);
    expect(res.body.data.ride.paymentStatus).toBe('not_required');
  });

  test('cancelling after the free window charges a fee payable by wallet', async () => {
    const created = await api.post('/api/rides').set(rider.auth).send({ pickup: MG_ROAD, dropoff: CUBBON, rideType: 'mini', paymentMethod: 'wallet' });
    const id = created.body.data._id;
    await api.post(`/api/driver/rides/${id}/accept`).set(driver.auth).expect(200);
    await Ride.updateOne({ _id: id }, { 'timeline.acceptedAt': new Date(Date.now() - 5 * 60000) });
    const res = await api.post(`/api/rides/${id}/cancel`).set(rider.auth).send({});
    expect(res.body.data.cancellationFee).toBe(50);
    const wallet = (await User.findById(rider.user._id)).walletBalance;
    const pay = await api.post(`/api/rides/${id}/pay`).set(rider.auth).send({ method: 'wallet' });
    expect(pay.status).toBe(200);
    expect((await User.findById(rider.user._id)).walletBalance).toBe(wallet - 50);
    expect((await User.findById(driver.user._id)).driver.isBusy).toBe(false);
  });

  test('driver cancelling puts the ride back into matching', async () => {
    const created = await api.post('/api/rides').set(rider.auth).send({ pickup: MG_ROAD, dropoff: CUBBON, rideType: 'mini', paymentMethod: 'cash' });
    const id = created.body.data._id;
    await api.post(`/api/driver/rides/${id}/accept`).set(driver.auth).expect(200);
    const res = await api.post(`/api/rides/${id}/cancel`).set(driver.auth).send({ reason: 'Flat tyre' });
    expect(res.body.data.ride.status).toBe('requested');
    expect((await api.post(`/api/driver/rides/${id}/accept`).set(driver.auth)).status).toBe(409); // can't re-take after declining
    await api.post(`/api/rides/${id}/cancel`).set(rider.auth).send({}).expect(200);
  });
});

describe('profile, support & admin', () => {
  test('adds a card (Luhn-validated) and UPI, rejects bad input', async () => {
    const bad = await api.post('/api/users/me/payment-methods').set(rider.auth).send({ type: 'card', cardNumber: '4242424242424241', expMonth: 12, expYear: 2030 });
    expect(bad.status).toBe(400);
    const card = await api.post('/api/users/me/payment-methods').set(rider.auth).send({ type: 'card', cardNumber: '5555 5555 5555 4444', expMonth: 12, expYear: 2030 });
    expect(card.status).toBe(201);
    expect(card.body.data.at(-1)).toMatchObject({ brand: 'mastercard', last4: '4444' });
    expect(card.body.data.at(-1).providerToken).toBeUndefined();
    const upi = await api.post('/api/users/me/payment-methods').set(rider.auth).send({ type: 'upi', upiId: 'not-a-upi' });
    expect(upi.status).toBe(400);
  });

  test('wallet top-up charges a saved card', async () => {
    const res = await api.post('/api/users/me/wallet/top-up').set(rider.auth).send({ amount: 500, paymentMethodId: rider.user.paymentMethods[0]._id });
    expect(res.status).toBe(200);
    expect(res.body.data.walletBalance).toBeGreaterThanOrEqual(500);
  });

  test('support ticket conversation between rider and admin', async () => {
    const t = await api.post('/api/support/tickets').set(rider.auth).send({ category: 'payment', subject: 'Refund request', message: 'Please refund my cancellation fee.' });
    expect(t.status).toBe(201);
    expect(t.body.data.priority).toBe('high');
    const reply = await api.post(`/api/support/tickets/${t.body.data._id}/messages`).set(admin.auth).send({ body: 'Refund processed.' });
    expect(reply.body.data.status).toBe('in_progress');
    const otherRider = await login(api, 'priya@cabconnect.dev');
    expect((await api.get(`/api/support/tickets/${t.body.data._id}`).set(otherRider.auth)).status).toBe(403);
    const closed = await api.patch(`/api/support/tickets/${t.body.data._id}`).set(admin.auth).send({ status: 'resolved' });
    expect(closed.body.data.status).toBe('resolved');
  });

  test('admin can suspend a user, who then cannot log in', async () => {
    const users = await api.get('/api/admin/users?q=kabir').set(admin.auth);
    const kabir = users.body.data[0];
    await api.patch(`/api/admin/users/${kabir._id}`).set(admin.auth).send({ isActive: false }).expect(200);
    const res = await api.post('/api/auth/login').send({ identifier: 'kabir@cabconnect.dev', password: 'Password@123' });
    expect(res.status).toBe(403);
  });

  test('admin promo CRUD with validation', async () => {
    const bad = await api.post('/api/admin/promos').set(admin.auth).send({ code: 'BAD', discountType: 'percent', value: 150 });
    expect(bad.status).toBe(400);
    const created = await api.post('/api/admin/promos').set(admin.auth).send({ code: 'TEST10', discountType: 'flat', value: 10 });
    expect(created.status).toBe(201);
    await api.delete(`/api/admin/promos/${created.body.data._id}`).set(admin.auth).expect(200);
  });

  test('unknown routes and malformed ids return clean errors', async () => {
    expect((await api.get('/api/nope')).status).toBe(404);
    const res = await api.get('/api/rides/not-an-id').set(rider.auth);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: { message: 'Invalid id' } });
  });
});
