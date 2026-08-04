const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let adminToken = '';

beforeAll(async () => {
  await sequelize.authenticate();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || '141103' });
  adminToken = res.body.data?.token || res.body.token || '';
});

afterAll(async () => { await sequelize.close(); });

describe('Commissions API — smoke tests', () => {
  it('GET /api/sales/commissions sin auth -> 401', async () => {
    const res = await request(app).get('/api/sales/commissions');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/sales/commissions con token -> 200 y shape válido', async () => {
    const res = await request(app)
      .get('/api/sales/commissions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('by_vendedor');
    expect(Array.isArray(res.body.data.by_vendedor)).toBe(true);
    expect(res.body.data).toHaveProperty('currency', 'COP');
  });

  it('GET /api/sales/commissions con rango de fechas -> 200', async () => {
    const res = await request(app)
      .get('/api/sales/commissions')
      .query({ from: '2026-07-01', to: '2026-07-31' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toHaveProperty('total_commission_cop');
  });

  it('GET /api/sales/commissions con rango sin ventas -> total 0 y vendedores 0', async () => {
    const res = await request(app)
      .get('/api/sales/commissions')
      .query({ from: '2000-01-01', to: '2000-01-02' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.total_commission_cop).toBe(0);
    expect(res.body.data.summary.vendedor_count).toBe(0);
  });

  it('GET /api/sales/commissions?user_id=1 -> 200 y solo ese vendedor', async () => {
    const res = await request(app)
      .get('/api/sales/commissions')
      .query({ user_id: '1', from: '2026-07-01', to: '2026-07-31' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const v of res.body.data.by_vendedor) {
      expect(v.user_id).toBe(1);
    }
  });

  it('GET /api/sales/commissions?detail=true -> detail es array', async () => {
    const res = await request(app)
      .get('/api/sales/commissions')
      .query({ detail: 'true', from: '2026-07-01', to: '2026-07-31' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.detail)).toBe(true);
  });

  it('GET /api/sales/commissions con fechas inválidas -> 200 o 400 (sin crash)', async () => {
    const res = await request(app)
      .get('/api/sales/commissions')
      .query({ from: 'fecha-no-valida', to: '2026-07-31' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(500);
  });
});
