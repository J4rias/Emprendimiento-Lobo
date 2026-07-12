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
  it('GET /api/catalog sin auth -> 200 (catálogo público por diseño)', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(200);
  });

  it('GET /api/catalog con token -> 200, body.data es array o tiene data', async () => {
    const res = await request(app)
      .get('/api/catalog')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.company || res.body.data).toBeTruthy();
  });

  it('POST /api/catalog -> 404 (el catálogo es solo lectura)', async () => {
    const res = await request(app)
      .post('/api/catalog')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('GET /api/catalog/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/catalog/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});
