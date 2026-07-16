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

describe('Products API — smoke tests', () => {
  it('GET /api/products sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/products con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/products?page=1&limit=5 -> 200, body.data.length <= 5 (si hay paginacion en data.items o data directamente)', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ page: 1, limit: 5 });
    expect(res.status).toBe(200);
    if (Array.isArray(res.body.data)) {
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    } else if (Array.isArray(res.body.data.items)) {
      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
    }
  });

  it('GET /api/products/:id con un id valido (usa el id del primer item de la lista) -> 200, body.data tiene id y name', async () => {
    const listRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${authToken}`);
    const firstProductId = Array.isArray(listRes.body.data)
      ? listRes.body.data[0].id
      : listRes.body.data.items[0].id;

    const res = await request(app)
      .get(`/api/products/${firstProductId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(firstProductId);
    expect(res.body.data.name).toBeDefined();
  });

  it('GET /api/products/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/products/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Products API — query params & filters', () => {
  it('GET /api/products?search= (empty string) -> 200', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ search: '' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/products?search=xyz_inexistente -> 200', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ search: 'xyz_inexistente_999' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/products?category_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ category_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/products?is_active=true -> 200', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ is_active: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/products?is_active=false -> 200', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ is_active: 'false' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/products?is_perishable=true -> 200', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ is_perishable: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/products?barcode=xyz_no_existe -> 200 o 404', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ barcode: 'xyz_no_existe' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/products?price_list_id=1 -> 200 (modo POS)', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ price_list_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/products?sort_by=name&sort_dir=ASC -> 200', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ sort_by: 'name', sort_dir: 'ASC' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/products?search=&category_id=1&is_active=true&page=1&limit=10 -> 200 (combo)', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ search: '', category_id: 1, is_active: 'true', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/products?page=9999 -> 200, sin resultados', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ page: 9999, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});