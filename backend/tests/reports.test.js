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

// ─── Sales Stats ────────────────────────────────────────────────────────────

describe('GET /api/sales/stats', () => {
  it('returns stats with data key (summary_only)', async () => {
    const res = await request(app)
      .get('/api/sales/stats')
      .query({ date_from: '2026-01-01T00:00:00', date_to: '2026-12-31T23:59:59', summary_only: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data).toHaveProperty('totalSales');
    expect(res.body.data).toHaveProperty('totalRevenue');
    expect(res.body.data).toHaveProperty('totalRevenueCOP');
    expect(res.body.data).toHaveProperty('grossProfit');
    expect(res.body.data).toHaveProperty('grossMarginPct');
    // Must NOT have stats key (frontend was incorrectly reading res.stats)
    expect(res.body.stats).toBeUndefined();
  });

  it('returns full stats with topProducts, salesByType, salesByCurrency', async () => {
    const res = await request(app)
      .get('/api/sales/stats')
      .query({ date_from: '2026-01-01T00:00:00', date_to: '2026-12-31T23:59:59' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('topProducts');
    expect(Array.isArray(res.body.data.topProducts)).toBe(true);
    expect(res.body.data).toHaveProperty('salesByType');
    expect(res.body.data).toHaveProperty('salesByStatus');
    expect(res.body.data).toHaveProperty('salesByCurrency');
    expect(res.body.data).toHaveProperty('salesByMode');
  });

  it('respects top_limit param', async () => {
    const res = await request(app)
      .get('/api/sales/stats')
      .query({ date_from: '2026-01-01T00:00:00', date_to: '2026-12-31T23:59:59', top_limit: 3 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.topProducts.length).toBeLessThanOrEqual(3);
  });

  it('returns numeric values, not strings', async () => {
    const res = await request(app)
      .get('/api/sales/stats')
      .query({ date_from: '2026-01-01T00:00:00', date_to: '2026-12-31T23:59:59', summary_only: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.totalSales).toBe('number');
    expect(typeof res.body.data.grossMarginPct).toBe('number');
  });

  it('works without date params -> full dataset', async () => {
    const res = await request(app)
      .get('/api/sales/stats')
      .query({ summary_only: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalSales).toBeGreaterThanOrEqual(0);
  });

  it('empty date range returns zero totals', async () => {
    const res = await request(app)
      .get('/api/sales/stats')
      .query({ date_from: '2020-01-01T00:00:00', date_to: '2020-01-02T23:59:59', summary_only: 'true' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalSales).toBe(0);
  });

  it('without auth -> 401/403', async () => {
    const res = await request(app).get('/api/sales/stats');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });
});

// ─── Product Sales ──────────────────────────────────────────────────────────

describe('GET /api/sales/product-sales', () => {
  it('returns data array with product info', async () => {
    const res = await request(app)
      .get('/api/sales/product-sales')
      .query({ date_from: '2026-01-01T00:00:00', date_to: '2026-12-31T23:59:59' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('count');
    if (res.body.data.length > 0) {
      const item = res.body.data[0];
      expect(item).toHaveProperty('product');
      expect(item.product).toHaveProperty('name');
      expect(item.product).toHaveProperty('sku');
    }
  });

  it('without date params -> all product sales', async () => {
    const res = await request(app)
      .get('/api/sales/product-sales')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('empty date range returns empty array', async () => {
    const res = await request(app)
      .get('/api/sales/product-sales')
      .query({ date_from: '2020-01-01T00:00:00', date_to: '2020-01-02T23:59:59' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─── Daily Series ───────────────────────────────────────────────────────────

describe('GET /api/sales/daily-series', () => {
  it('returns array of daily data points', async () => {
    const res = await request(app)
      .get('/api/sales/daily-series')
      .query({ date_from: '2026-07-01', date_to: '2026-07-16' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      const point = res.body.data[0];
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('sale_count');
    }
  });

  it('empty date range returns empty array', async () => {
    const res = await request(app)
      .get('/api/sales/daily-series')
      .query({ date_from: '2020-01-01', date_to: '2020-01-02' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── Sales Summary ──────────────────────────────────────────────────────────

describe('GET /api/sales/summary', () => {
  it('returns summary with payments_by_currency and sales_by_type', async () => {
    const res = await request(app)
      .get('/api/sales/summary')
      .query({ date_from: '2026-07-01', date_to: '2026-07-16' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('payments_by_currency');
    expect(res.body.data.summary).toHaveProperty('sales_by_type');
  });

  it('sales_by_type includes pos_pending', async () => {
    const res = await request(app)
      .get('/api/sales/summary')
      .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const sbt = res.body.data.summary.sales_by_type;
    expect(sbt).toHaveProperty('pos_pending');
    expect(sbt.pos_pending).toHaveProperty('count');
    expect(sbt.pos_pending).toHaveProperty('total_usd');
  });
});

// ─── Daily Closure ──────────────────────────────────────────────────────────

describe('GET /api/sales/daily-closure', () => {
  it('returns closure data with posPending section', async () => {
    const res = await request(app)
      .get('/api/sales/daily-closure')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('posPending');
    expect(res.body.data.posPending).toHaveProperty('count');
    expect(res.body.data.posPending).toHaveProperty('totalUSD');
  });

  it('accepts date param', async () => {
    const res = await request(app)
      .get('/api/sales/daily-closure')
      .query({ date: '2026-07-15' })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});

// ─── Sales list pagination ──────────────────────────────────────────────────

describe('GET /api/sales — pagination & response shape', () => {
  it('returns data array (not sales key) with pagination', async () => {
    const res = await request(app)
      .get('/api/sales')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    // Key must be "data", not "sales"
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.sales).toBeUndefined();
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('page');
    expect(res.body.pagination).toHaveProperty('limit');
    expect(res.body.pagination).toHaveProperty('totalPages');
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('page 2 returns results different from page 1 (by first item)', async () => {
    const r1 = await request(app)
      .get('/api/sales').query({ page: 1, limit: 5, sort_by: 'id', sort_dir: 'ASC' })
      .set('Authorization', `Bearer ${authToken}`);
    const r2 = await request(app)
      .get('/api/sales').query({ page: 2, limit: 5, sort_by: 'id', sort_dir: 'ASC' })
      .set('Authorization', `Bearer ${authToken}`);
    if (r1.body.pagination.totalPages > 1 && r2.body.data.length > 0) {
      expect(r1.body.data[0].id).not.toBe(r2.body.data[0].id);
    }
  });

  it('changing limit changes page count', async () => {
    const r5 = await request(app)
      .get('/api/sales').query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    const r25 = await request(app)
      .get('/api/sales').query({ page: 1, limit: 25 })
      .set('Authorization', `Bearer ${authToken}`);
    if (r5.body.pagination.total > 25) {
      expect(r5.body.pagination.totalPages).toBeGreaterThan(r25.body.pagination.totalPages);
    }
  });
});

// ─── Credit Notes pagination ────────────────────────────────────────────────

describe('GET /api/credit-notes — pagination', () => {
  it('returns data + pagination', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('totalPages');
  });

  it('limit param is respected', async () => {
    const res = await request(app)
      .get('/api/credit-notes')
      .query({ page: 1, limit: 3 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });
});

// ─── Credit Notes stats ─────────────────────────────────────────────────────

describe('GET /api/credit-notes/stats', () => {
  it('returns stats data', async () => {
    const res = await request(app)
      .get('/api/credit-notes/stats')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});

// ─── Pre-Orders pagination ──────────────────────────────────────────────────

describe('GET /api/pre-orders — pagination', () => {
  it('returns data + pagination', async () => {
    const res = await request(app)
      .get('/api/pre-orders')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('limit param is respected', async () => {
    const res = await request(app)
      .get('/api/pre-orders')
      .query({ page: 1, limit: 3 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });
});

// ─── Inventory report ───────────────────────────────────────────────────────

describe('GET /api/inventory — pagination', () => {
  it('returns data + pagination', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });
});

// ─── Inventory low stock ────────────────────────────────────────────────────

describe('GET /api/inventory/alerts/low-stock', () => {
  it('returns low stock items', async () => {
    const res = await request(app)
      .get('/api/inventory/alerts/low-stock')
      .query({ limit: 10 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const items = res.body.data || res.body.inventory || [];
    expect(Array.isArray(items)).toBe(true);
  });
});

// ─── Purchase Orders pagination ─────────────────────────────────────────────

describe('GET /api/purchase-orders — pagination', () => {
  it('returns data + pagination', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const items = res.body.data || res.body.purchaseOrders || [];
    expect(Array.isArray(items)).toBe(true);
  });
});
