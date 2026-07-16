const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let authToken = '';
let testListId = null;
let testProductId = null;
let testPresentationId = null;

beforeAll(async () => {
  await sequelize.authenticate();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
  authToken = res.body.data?.token || res.body.token || '';

  // Find a price list with details for PATCH tests
  const lists = await request(app)
    .get('/api/price-lists')
    .set('Authorization', `Bearer ${authToken}`);
  if (lists.body.data?.length) {
    for (const list of lists.body.data) {
      const [row] = await sequelize.query(
        'SELECT product_id, presentation_id FROM price_list_details WHERE price_list_id = ? LIMIT 1',
        { replacements: [list.id], type: sequelize.QueryTypes.SELECT }
      );
      if (row) {
        testListId = list.id;
        testProductId = row.product_id;
        testPresentationId = row.presentation_id;
        break;
      }
    }
  }
});

afterAll(async () => { await sequelize.close(); });

describe('Price Lists API — smoke tests', () => {
  it('GET /api/price-lists sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/price-lists');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/price-lists con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/price-lists')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/price-lists con body vacío {} CON token -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/price-lists')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('GET /api/price-lists/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/price-lists/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/price-lists/:id/detail', () => {
  const basePayload = () => ({
    product_id: testProductId,
    presentation_id: testPresentationId,
    package_cost: 50,
    unit_cost: 4.17,
    package_price: 60,
    unit_price: 5,
    margin_percentage: 20,
  });

  it('actualizar precio COP con nulls en frozen/client_updated_at -> 200', async () => {
    if (!testListId) return;
    const res = await request(app)
      .patch(`/api/price-lists/${testListId}/detail`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...basePayload(),
        frozen_price: null,
        frozen_currency: null,
        package_price_usd: 0,
        client_updated_at: null,
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.package_price).toBe(60);
    expect(res.body.data.frozen_price).toBeNull();
  });

  it('actualizar precio USD (package_price_usd) -> 200', async () => {
    if (!testListId) return;
    const res = await request(app)
      .patch(`/api/price-lists/${testListId}/detail`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...basePayload(),
        package_price_usd: 15.50,
        frozen_price: null,
        frozen_currency: null,
        client_updated_at: null,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.package_price_usd).toBe(15.5);
  });

  it('congelar precio -> 200 con is_frozen=true y frozen_price', async () => {
    if (!testListId) return;
    const res = await request(app)
      .patch(`/api/price-lists/${testListId}/detail`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...basePayload(),
        is_frozen: true,
        frozen_price: 165000,
        frozen_currency: 'COP',
        package_price_usd: 0,
        client_updated_at: null,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.is_frozen).toBe(true);
    expect(res.body.data.frozen_price).toBe(165000);
    expect(res.body.data.frozen_currency).toBe('COP');
  });

  it('descongelar precio -> 200 con is_frozen=false y frozen_price=null', async () => {
    if (!testListId) return;
    const res = await request(app)
      .patch(`/api/price-lists/${testListId}/detail`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...basePayload(),
        is_frozen: false,
        frozen_price: null,
        frozen_currency: null,
        package_price_usd: 0,
        client_updated_at: null,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.is_frozen).toBe(false);
    expect(res.body.data.frozen_price).toBeNull();
  });

  it('sin auth -> 401 o 403', async () => {
    if (!testListId) return;
    const res = await request(app)
      .patch(`/api/price-lists/${testListId}/detail`)
      .send(basePayload());
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('lista inexistente -> 404', async () => {
    const res = await request(app)
      .patch('/api/price-lists/99999999/detail')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...basePayload(),
        frozen_price: null,
        frozen_currency: null,
        client_updated_at: null,
      });
    expect(res.status).toBe(404);
  });
});
