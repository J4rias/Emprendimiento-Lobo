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

describe('Inventory API — smoke tests', () => {
  it('GET /api/inventory sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/inventory con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory/warehouses con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/inventory/warehouses')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory/alerts/low-stock con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/inventory/alerts/low-stock')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Inventory API — query params & filters', () => {
  it('GET /api/inventory?warehouse_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ warehouse_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory?warehouse_id=all -> 200', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ warehouse_id: 'all' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory?product_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ product_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/inventory?search= (empty string) -> 200', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ search: '' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory?search=xyz_inexistente -> 200', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ search: 'xyz_inexistente_999' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory?category_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ category_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory?low_stock=true -> 200', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ low_stock: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory?out_of_stock=true -> 200', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ out_of_stock: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory?expiring=true -> 200', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ expiring: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/inventory?page=1&limit=5 -> 200, max 5 resultados', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/inventory?search=&low_stock=true&category_id=1&page=1&limit=10 -> 200 (combo)', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ search: '', low_stock: 'true', category_id: 1, page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
