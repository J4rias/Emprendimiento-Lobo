const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let authToken = '';
let createdId = null;
const TEST_NAME = 'CAT_TEST_' + Date.now();

beforeAll(async () => {
  await sequelize.authenticate();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
  authToken = res.body.data?.token || res.body.token || '';
});

afterAll(async () => { await sequelize.close(); });

describe('Categories API', () => {
  it('GET /api/categories sin Authorization header -> status 401 o 403', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/categories con token valido -> status 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/categories con { name: TEST_NAME } y token -> status 201, body.data tiene id y name; guardar id en createdId', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: TEST_NAME, code: 'TSTCAT' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe(TEST_NAME);
    createdId = res.body.data.id;
  });

  it('POST /api/categories con el mismo TEST_NAME -> status 409 (duplicado)', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: TEST_NAME, code: 'TSTCAT' });
    expect(res.status).toBe(409);
  });

  it('PUT /api/categories/:createdId con nuevo nombre -> status 200', async () => {
    const newName = `${TEST_NAME}_updated`;
    const res = await request(app)
      .put(`/api/categories/${createdId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: newName });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/categories/:createdId -> status 200', async () => {
    const res = await request(app)
      .delete(`/api/categories/${createdId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});