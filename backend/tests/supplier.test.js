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

describe('Suppliers API — smoke tests', () => {
  it('GET /api/suppliers sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/suppliers');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/suppliers con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/suppliers con body vacío {} CON token -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('GET /api/suppliers/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/suppliers/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/suppliers/resumen con token -> 200, body.data tiene resumen', async () => {
    const res = await request(app)
      .get('/api/suppliers/resumen')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/suppliers/:id/statement -> 404 (endpoint legacy eliminado, usar /ledger)', async () => {
    const res = await request(app)
      .get('/api/suppliers/1/statement')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/suppliers/:id/ledger con id=1 -> 200, body.data tiene categorías (USD/DIVISAS/COP)', async () => {
    const res = await request(app)
      .get('/api/suppliers/1/ledger')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.categories).toBeDefined();
    expect(res.body.data.supplier).toBeDefined();
  });
});
