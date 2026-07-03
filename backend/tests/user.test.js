const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let authToken = '';
let createdUserId = null;
const TEST_USERNAME = 'test_user_' + Date.now();

beforeAll(async () => {
  await sequelize.authenticate();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
  authToken = res.body.data?.token || res.body.token || '';
});

afterAll(async () => { await sequelize.close(); });

describe('Users API', () => {
  it('GET /api/users sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/users con token admin -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });

  it('POST /api/users con datos validos (username: TEST_USERNAME, password, role_id: 1) -> 201, body.data tiene id; guardar en createdUserId', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ username: TEST_USERNAME, password: 'password123', role_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    createdUserId = res.body.data.id;
  });

  it('POST /api/users con el mismo TEST_USERNAME -> 409 (duplicado)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ username: TEST_USERNAME, password: 'password123', role_id: 1 });
    expect(res.status).toBe(409);
  });

  it('PUT /api/users/:createdUserId -> 200', async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ first_name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/users/:createdUserId -> 200', async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});