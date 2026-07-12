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

describe('Pre-Orders API — smoke tests', () => {
  it('GET /api/pre-orders sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/pre-orders');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/pre-orders con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/pre-orders')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/pre-orders con body vacío {} -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/pre-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/pre-orders/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/pre-orders/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});
