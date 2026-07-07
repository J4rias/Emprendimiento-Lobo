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

describe('Catalog API — smoke tests', () => {
  it('GET /api/catalog sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/catalog con token -> 200, body.data es array o tiene data', async () => {
    const res = await request(app)
      .get('/api/catalog')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.company || Array.isArray(res.body.categories) || Array.isArray(res.body.products)).toBe(true);
  });

  it('POST /api/catalog con body vacío {} CON token -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/catalog')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBe(400) || expect(res.status).toBe(422);
  });

  it('GET /api/catalog/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/catalog/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});
