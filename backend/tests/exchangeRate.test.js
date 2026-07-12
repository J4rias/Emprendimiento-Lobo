const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let authToken = '';
let createdId = null;
// Par y fecha improbables en datos reales para no colisionar con tasas vigentes
const TEST_RATE = { from_currency: 'COP', to_currency: 'VES', rate: 4200, effective_date: '2099-01-01' };

beforeAll(async () => {
  await sequelize.authenticate();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
  authToken = res.body.data?.token || res.body.token || '';
});

afterAll(async () => { await sequelize.close(); });

describe('Exchange Rates API', () => {
  test('GET /api/exchange-rates con token válido -> status 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/exchange-rates')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/exchange-rates con from/to/rate/effective_date -> status 201, body.data tiene id; guardar en createdId', async () => {
    const res = await request(app)
      .post('/api/exchange-rates')
      .set('Authorization', `Bearer ${authToken}`)
      .send(TEST_RATE);
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    createdId = res.body.data.id;
  });

  test('POST /api/exchange-rates con el mismo par y la misma fecha -> status 409 (duplicado)', async () => {
    const res = await request(app)
      .post('/api/exchange-rates')
      .set('Authorization', `Bearer ${authToken}`)
      .send(TEST_RATE);
    expect(res.status).toBe(409);
  });

  test('GET /api/exchange-rates/:createdId -> status 200 con el par creado', async () => {
    const res = await request(app)
      .get(`/api/exchange-rates/${createdId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.from_currency).toBe(TEST_RATE.from_currency);
    expect(res.body.data.to_currency).toBe(TEST_RATE.to_currency);
  });

  test('DELETE /api/exchange-rates/:createdId -> status 200', async () => {
    const res = await request(app)
      .delete(`/api/exchange-rates/${createdId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});