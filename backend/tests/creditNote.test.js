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

describe('Credit Notes API — smoke tests', () => {
  it('GET /api/credit-notes sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/credit-notes');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/credit-notes con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/credit-notes con body vacío {} -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('GET /api/credit-notes/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/credit-notes/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Credit Notes API — query params & filters', () => {
  it('GET /api/credit-notes?search= (empty string) -> 200', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ search: '' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/credit-notes?search=xyz_inexistente -> 200', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ search: 'xyz_inexistente_999' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/credit-notes?status=approved -> 200', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ status: 'approved' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/credit-notes?customer_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ customer_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/credit-notes?sale_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ sale_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/credit-notes?date_from=2026-01-01&date_to=2026-12-31 -> 200', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/credit-notes?page=1&limit=5 -> 200, max 5', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/credit-notes?search=&status=approved&customer_id=1&page=1&limit=10 -> 200 (combo)', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ search: '', status: 'approved', customer_id: 1, page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
