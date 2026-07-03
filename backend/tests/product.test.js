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

describe('Products API — smoke tests', () => {
  it('GET /api/products sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/products con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/products?page=1&limit=5 -> 200, body.data.length <= 5 (si hay paginacion en data.items o data directamente)', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ page: 1, limit: 5 });
    expect(res.status).toBe(200);
    if (Array.isArray(res.body.data)) {
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    } else if (Array.isArray(res.body.data.items)) {
      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
    }
  });

  it('GET /api/products/:id con un id valido (usa el id del primer item de la lista) -> 200, body.data tiene id y name', async () => {
    const listRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${authToken}`);
    const firstProductId = Array.isArray(listRes.body.data)
      ? listRes.body.data[0].id
      : listRes.body.data.items[0].id;

    const res = await request(app)
      .get(`/api/products/${firstProductId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(firstProductId);
    expect(res.body.data.name).toBeDefined();
  });

  it('GET /api/products/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/products/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});