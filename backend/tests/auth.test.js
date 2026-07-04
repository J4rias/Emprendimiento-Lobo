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

describe('Auth API', () => {
  test('POST /api/auth/login con credenciales validas -> status 200, body.data contiene token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });

  test('POST /api/auth/login con password incorrecto -> status 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: process.env.TEST_USER || 'admin', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login con usuario inexistente -> status 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistentuser', password: 'admin123' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login sin username ni password -> status 400 o 422', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/auth/logout con Authorization: Bearer <authToken> -> status 200', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/auth/me o /api/auth/verify con token valido -> status 200 (si existe el endpoint; si no, omitir)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});