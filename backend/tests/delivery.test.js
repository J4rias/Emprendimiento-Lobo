const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let authToken = '';

beforeAll(async () => {
  await sequelize.authenticate();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
  authToken = res.body.data?.token || res.body.token || '';
});

afterAll(async () => { await sequelize.close(); });

describe('Deliveries API — smoke tests', () => {
  it('GET /api/deliveries sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/deliveries');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/deliveries con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/deliveries con body vacío {} -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('GET /api/deliveries/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/deliveries/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Deliveries API — query params & filters', () => {
  it('GET /api/deliveries?search= (empty string) -> 200', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .query({ search: '' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/deliveries?search=xyz_inexistente -> 200', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .query({ search: 'xyz_inexistente_999' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/deliveries?status=pending -> 200', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/deliveries?customer_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .query({ customer_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/deliveries?date_from=2026-01-01&date_to=2026-12-31 -> 200', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/deliveries?page=1&limit=5 -> 200, max 5', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/deliveries?search=&status=pending&page=1&limit=10 -> 200 (combo)', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .query({ search: '', status: 'pending', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
