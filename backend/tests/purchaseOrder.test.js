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

describe('Purchase Orders API — smoke tests', () => {
  it('GET /api/purchase-orders sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/purchase-orders');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/purchase-orders con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/purchase-orders con body vacío {} CON token -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/purchase-orders/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/purchase-orders/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Purchase Orders API — query params & filters', () => {
  it('GET /api/purchase-orders?search= (empty string) -> 200', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ search: '' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/purchase-orders?search=xyz_inexistente -> 200', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ search: 'xyz_inexistente_999' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/purchase-orders?status=pending -> 200', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/purchase-orders?supplier_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ supplier_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/purchase-orders?date_from=2026-01-01&date_to=2026-12-31 -> 200', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/purchase-orders?page=1&limit=5 -> 200, max 5', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/purchase-orders?sort_by=created_at&sort_dir=ASC -> 200', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ sort_by: 'created_at', sort_dir: 'ASC' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/purchase-orders?search=&status=pending&supplier_id=1&page=1&limit=10 -> 200 (combo)', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ search: '', status: 'pending', supplier_id: 1, page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
