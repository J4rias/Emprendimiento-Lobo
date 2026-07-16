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

describe('Quotes API — smoke tests', () => {
  it('GET /api/quotes sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/quotes');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/quotes con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/quotes')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/quotes con body vacío {} CON token -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect([400, 422]).toContain(res.status);
  });

  it('GET /api/quotes/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/quotes/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Quotes API — query params & filters', () => {
  it('GET /api/quotes?search= (empty string) -> 200', async () => {
    const res = await request(app)
      .get('/api/quotes')
      .query({ search: '' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/quotes?search=xyz_inexistente -> 200', async () => {
    const res = await request(app)
      .get('/api/quotes')
      .query({ search: 'xyz_inexistente_999' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/quotes?status=draft -> 200', async () => {
    const res = await request(app)
      .get('/api/quotes')
      .query({ status: 'draft' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/quotes?customer_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/quotes')
      .query({ customer_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/quotes?date_from=2026-01-01&date_to=2026-12-31 -> 200', async () => {
    const res = await request(app)
      .get('/api/quotes')
      .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/quotes?page=1&limit=5 -> 200, max 5', async () => {
    const res = await request(app)
      .get('/api/quotes')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/quotes?sort_by=created_at&sort_dir=ASC -> 200', async () => {
    const res = await request(app)
      .get('/api/quotes')
      .query({ sort_by: 'created_at', sort_dir: 'ASC' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/quotes?search=&status=draft&page=1&limit=10 -> 200 (combo)', async () => {
    const res = await request(app)
      .get('/api/quotes')
      .query({ search: '', status: 'draft', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
