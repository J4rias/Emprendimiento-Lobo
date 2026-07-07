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

describe('Accounts Receivable API — smoke tests', () => {
  it('GET /api/accounts-receivable/summary sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/accounts-receivable/summary');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/accounts-receivable/summary con token -> 200, body.data es objeto', async () => {
    const res = await request(app)
      .get('/api/accounts-receivable/summary')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data === 'object').toBe(true);
  });

  it('POST /api/accounts-receivable/admin-pin con body vacío {} CON token -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/accounts-receivable/admin-pin')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('GET /api/accounts-receivable/customers/:id/statement con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/accounts-receivable/customers/99999999/statement')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});
