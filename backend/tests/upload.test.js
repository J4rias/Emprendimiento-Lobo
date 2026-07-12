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

describe('Uploads API — smoke tests', () => {
  it('GET /api/uploads sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/uploads');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/uploads con token -> 404 (solo POST / y POST /multiple)', async () => {
    const res = await request(app)
      .get('/api/uploads')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });

  it('POST /api/uploads con body vacío {} CON token -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect([400, 422]).toContain(res.status);
  });

  it('GET /api/uploads/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/uploads/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});
