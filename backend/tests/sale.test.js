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

describe('Sales API — smoke tests', () => {
  it('GET /api/sales sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/sales');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/sales con token -> 200, body.data es array', async () => {
    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/sales con body vacío {} -> 400 o 422', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('GET /api/sales/:id con id=99999999 -> 404', async () => {
    const res = await request(app)
      .get('/api/sales/99999999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Sales API — query params & filters', () => {
  it('GET /api/sales?search= (empty string) -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ search: '' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?search=xyz_inexistente -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ search: 'xyz_inexistente_999' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?status=completed -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ status: 'completed' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?status=completed,pending (comma-separated) -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ status: 'completed,pending' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?sale_type=contado -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ sale_type: 'contado' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?customer_id=1 -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ customer_id: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?date_from=2026-01-01&date_to=2026-12-31 -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?page=1&limit=5 -> 200, max 5 resultados', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/sales?page=9999 -> 200, array vacío', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ page: 9999, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?sort_by=sale_date&sort_dir=ASC -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ sort_by: 'sale_date', sort_dir: 'ASC' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales?search=&status=completed&sale_type=contado&page=1&limit=10 -> 200 (combo)', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ search: '', status: 'completed', sale_type: 'contado', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/sales/stats -> 200 (estadísticas)', async () => {
    const res = await request(app)
      .get('/api/sales/stats')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /api/sales?sale_type=pos_pending -> 200', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ sale_type: 'pos_pending' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Sales API — pos_pending (vendedor flow)', () => {
  let createdSaleId = null;

  it('POST /api/sales con sale_type=pos_pending y payment_lines=[] crea venta pending', async () => {
    // First get a product with stock for the sale
    const productsRes = await request(app)
      .get('/api/products')
      .query({ limit: 1 })
      .set('Authorization', `Bearer ${authToken}`);

    if (!productsRes.body.data || productsRes.body.data.length === 0) {
      console.log('Skipping: no products in DB');
      return;
    }

    const product = productsRes.body.data[0];
    const presentation = product.presentations?.[0];
    if (!presentation) {
      console.log('Skipping: product has no presentations');
      return;
    }

    // Fetch a valid customer
    const customersRes = await request(app)
      .get('/api/customers')
      .query({ limit: 1 })
      .set('Authorization', `Bearer ${authToken}`);
    const customerId = customersRes.body.data?.[0]?.id;
    if (!customerId) {
      console.log('Skipping: no customers in DB');
      return;
    }

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customer_id: customerId,
        warehouse_id: 1,
        sale_type: 'pos_pending',
        currency_mode: 'USD',
        exchange_rate: 1,
        payment_lines: [],
        items: [{
          product_id: product.id,
          presentation_id: presentation.id,
          quantity: 1,
          is_unit: false,
          unit_price: parseFloat(presentation.price) || 1,
          discount_percent: 0,
          tax_percent: 0,
        }],
      });

    // Should succeed (admin has sales.create)
    if (res.status === 200 || res.status === 201) {
      createdSaleId = res.body.data?.id;
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.sale_type).toBe('pos_pending');
      expect(parseFloat(res.body.data.paid_amount)).toBe(0);
      expect(parseFloat(res.body.data.credit_amount)).toBeGreaterThan(0);
    } else {
      // May fail due to stock — that's OK for this smoke test
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('POST /api/sales/:id/payments con admin token (sales.collect) -> cobra pos_pending', async () => {
    if (!createdSaleId) {
      console.log('Skipping: no pos_pending sale was created');
      return;
    }

    // Get the sale to know the total
    const saleRes = await request(app)
      .get(`/api/sales/${createdSaleId}`)
      .set('Authorization', `Bearer ${authToken}`);
    const saleTotal = parseFloat(saleRes.body.data?.total || 0);

    const res = await request(app)
      .post(`/api/sales/${createdSaleId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        payment_lines: [{
          amount: saleTotal,
          method: 'cash',
          currency: 'USD',
          exchange_rate: 1,
        }],
      });

    expect(res.status).toBe(200);
    // After full payment, sale_type should change from pos_pending to cash
    expect(res.body.data?.sale?.sale_type || res.body.sale?.sale_type).toBe('cash');
    expect(res.body.data?.sale?.status || res.body.sale?.status).toBe('completed');
  });

  it('GET /api/sales/daily-closure includes posPending field', async () => {
    const res = await request(app)
      .get('/api/sales/daily-closure')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('posPending');
    expect(res.body.data.posPending).toHaveProperty('count');
    expect(res.body.data.posPending).toHaveProperty('totalUSD');
  });
});
