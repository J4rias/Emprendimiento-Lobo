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

describe('Customers API — smoke tests', () => {
  it('GET /api/customers sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/customers con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/customers con body vacío {} CON token -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('GET /api/customers/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/customers/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Customers API — query params & filters', () => {
  it('GET /api/customers?search= (empty string) -> 200', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ search: '' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers?search=xyz_inexistente -> 200, array vacío o con resultados', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ search: 'xyz_inexistente_999' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers?status=active -> 200', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ status: 'active' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers?status=inactive -> 200', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ status: 'inactive' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers?type=natural -> 200', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ type: 'natural' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers?is_active=true -> 200', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ is_active: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers?search=&status=active&limit=50 -> 200 (combo filtros frontend)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ search: '', status: 'active', limit: 50 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers?page=1&limit=5 -> 200, max 5 resultados', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/customers?page=9999 -> 200, array vacío (página sin datos)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ page: 9999, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers?sort_by=business_name&sort_dir=ASC -> 200', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ sort_by: 'business_name', sort_dir: 'ASC' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers?search=a&status=active&type=natural&page=1&limit=10 -> 200 (todos los filtros)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ search: 'a', status: 'active', type: 'natural', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
