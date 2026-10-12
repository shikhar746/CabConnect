const { setup, teardown, login } = require('./setup');

let api;
beforeAll(async () => { api = await setup(); });
afterAll(teardown);

describe('auth', () => {
  test('registers a rider with welcome credit and returns a token', async () => {
    const res = await api.post('/api/auth/register').send({ name: 'Test Rider', email: 'new@rider.dev', phone: '9000000001', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.walletBalance).toBe(200);
    expect(res.body.data.user.password).toBeUndefined();
  });

  test('rejects duplicate email and weak password', async () => {
    const dup = await api.post('/api/auth/register').send({ name: 'X Y', email: 'rider@cabconnect.dev', phone: '9000000002', password: 'secret123' });
    expect(dup.status).toBe(409);
    const weak = await api.post('/api/auth/register').send({ name: 'X Y', email: 'weak@x.dev', phone: '9000000003', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.message).toMatch(/at least 8/);
  });

  test('driver registration requires vehicle details', async () => {
    const res = await api.post('/api/auth/register').send({ name: 'New Driver', email: 'nd@x.dev', phone: '9000000004', password: 'secret123', role: 'driver' });
    expect(res.status).toBe(400);
    const ok = await api.post('/api/auth/register').send({
      name: 'New Driver', email: 'nd@x.dev', phone: '9000000004', password: 'secret123', role: 'driver', licenseNumber: 'KA0120190001',
      vehicle: { type: 'mini', make: 'Tata', model: 'Tiago', color: 'White', plate: 'KA01AA0001' },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.user.driver.vehicle.plate).toBe('KA01AA0001');
  });

  test('login works with email or phone, fails with a bad password', async () => {
    expect((await login(api, 'rider@cabconnect.dev')).user.role).toBe('rider');
    expect((await login(api, '9876510001')).user.role).toBe('driver');
    const bad = await api.post('/api/auth/login').send({ identifier: 'rider@cabconnect.dev', password: 'nope' });
    expect(bad.status).toBe(401);
  });

  test('blocks NoSQL operator injection in login', async () => {
    const res = await api.post('/api/auth/login').send({ identifier: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  test('mock Google sign-in creates a rider account', async () => {
    const idToken = `mock-google.${Buffer.from(JSON.stringify({ email: 'g.user@gmail.com', name: 'G User' })).toString('base64url')}`;
    const res = await api.post('/api/auth/social').send({ provider: 'google', idToken });
    expect(res.status).toBe(200);
    expect(res.body.data.isNew).toBe(true);
    expect(res.body.data.user.email).toBe('g.user@gmail.com');
  });

  test('protected routes need a token and enforce roles', async () => {
    expect((await api.get('/api/auth/me')).status).toBe(401);
    const rider = await login(api, 'rider@cabconnect.dev');
    expect((await api.get('/api/admin/stats').set(rider.auth)).status).toBe(403);
    const admin = await login(api, 'admin@cabconnect.dev');
    const stats = await api.get('/api/admin/stats').set(admin.auth);
    expect(stats.status).toBe(200);
    expect(stats.body.data.series).toHaveLength(14);
  });
});
