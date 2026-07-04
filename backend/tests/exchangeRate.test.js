const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let authToken = '';
let createdId = null;
const TEST_PAIR = 'TST_TST';

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

  test('POST /api/exchange-rates con { pair: TEST_PAIR, rate: 4200, date: hoy en YYYY-MM-DD } -> status 201, body.data tiene id; guardar en createdId', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/exchange-rates')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ pair: TEST_PAIR, rate: 4200, date: today });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    createdId = res.body.data.id;
  });

  test('POST /api/exchange-rates con el mismo TEST_PAIR y la misma fecha -> status 409 (duplicado)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/exchange-rates')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ pair: TEST_PAIR, rate: 4200, date: today });
    expect(res.status).toBe(409);
  });

  test('GET /api/exchange-rates?pair=TEST_PAIR -> status 200, al menos un item con pair TEST_PAIR', async () => {
    const res = await request(app)
      .get(`/api/exchange-rates?pair=${TEST_PAIR}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const testPairItems = res.body.data.filter(item => item.pair === TEST_PAIR);
    expect(testPairItems.length).toBeGreaterThan(0);
  });

  test('DELETE /api/exchange-rates/:createdId -> status 200', async () => {
    const res = await request(app)
      .delete(`/api/exchange-rates/${createdId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});