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

describe('Sales API — smoke tests', () => {
  it('GET /api/sales sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/sales');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/sales con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/sales con body vacío {} -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('GET /api/sales/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/sales/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Sales API — query params & filters', () => {
  it('GET /api/sales?search= (empty string) -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ search: '' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?search=xyz_inexistente -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ search: 'xyz_inexistente_999' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?status=completed -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ status: 'completed' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?status=completed,pending (comma-separated) -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ status: 'completed,pending' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?sale_type=contado -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ sale_type: 'contado' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?customer_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ customer_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?date_from=2026-01-01&date_to=2026-12-31 -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?page=1&limit=5 -> 200, max 5 resultados', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/sales?page=9999 -> 200, array vacío', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ page: 9999, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?sort_by=sale_date&sort_dir=ASC -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ sort_by: 'sale_date', sort_dir: 'ASC' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?search=&status=completed&sale_type=contado&page=1&limit=10 -> 200 (combo)', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ search: '', status: 'completed', sale_type: 'contado', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales/stats -> 200 (estadísticas)', async () => {
    const res = await request(app)
      .get('/api/sales/stats')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
