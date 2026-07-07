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

describe('Packaging Types API — smoke tests', () => {
  it('GET /api/packaging-types/active sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/packaging-types/active');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/packaging-types/active con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/packaging-types/active')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/packaging-types con body vacío {} CON token -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/packaging-types')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('GET /api/packaging-types/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/packaging-types/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});
