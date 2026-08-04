/**
 * Cancel Sale with Prior Credit Note — Integration Tests
 *
 * Tests the scenario: create sale → partial return (NC) → cancel sale
 *
 * Verifies:
 *   1. Stock is NOT double-returned when cancelling a sale that has an applied NC
 *   2. Associated credit notes are cancelled automatically
 *
 * Self-cleaning: removes all test data in afterEach to avoid polluting the daily report.
 */
const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let adminToken = '';
let testProduct = null;
let testCustomerId = null;
const createdSaleIds = [];

beforeAll(async () => {
  await sequelize.authenticate();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
  adminToken = loginRes.body.data?.token || loginRes.body.token || '';
  expect(adminToken).toBeTruthy();

  // Find a product with plenty of stock
  const productsRes = await request(app)
    .get('/api/products')
    .query({ limit: 100 })
    .set('Authorization', `Bearer ${adminToken}`);

  for (const p of (productsRes.body.data || [])) {
    const pres = p.presentations?.[0];
    const stock = p.inventories?.reduce((s, i) => s + parseFloat(i.quantity || 0), 0) || 0;
    let price = parseFloat(pres?.base_price) || 0;

    if (pres && stock >= 20) {
      if (price <= 0) price = 2.00;
      testProduct = {
        id: p.id,
        presentation_id: pres.id,
        unit_price: price,
        units_per_package: parseFloat(pres.units_per_package) || 1,
      };
      break;
    }
  }
  expect(testProduct).toBeTruthy();

  const customersRes = await request(app)
    .get('/api/customers')
    .query({ limit: 5 })
    .set('Authorization', `Bearer ${adminToken}`);
  const customers = customersRes.body.data || [];
  expect(customers.length).toBeGreaterThan(0);
  testCustomerId = customers[0].id;
});

afterAll(async () => {
  // Final cleanup: hard-delete any remaining test data
  if (createdSaleIds.length > 0) {
    const { sequelize: seq } = require('../models');
    const cnDetailIds = await seq.query(
      'SELECT id FROM credit_note_details WHERE credit_note_id IN (SELECT id FROM credit_notes WHERE sale_id IN (:ids))',
      { replacements: { ids: createdSaleIds }, type: seq.QueryTypes.SELECT }
    );
    if (cnDetailIds.length > 0) {
      await seq.query('DELETE FROM credit_note_details WHERE id IN (:cnDetailIds)', { replacements: { cnDetailIds: cnDetailIds.map(c => c.id) } });
    }
    // Get NC numbers to clean their inventory movements too
    const cnNums = await seq.query('SELECT credit_note_number FROM credit_notes WHERE sale_id IN (:ids)', { replacements: { ids: createdSaleIds }, type: seq.QueryTypes.SELECT });
    const cnNumberList = cnNums.map(c => c.credit_note_number);
    await seq.query('DELETE FROM credit_notes WHERE sale_id IN (:ids)', { replacements: { ids: createdSaleIds } });
    await seq.query('DELETE FROM sale_payments WHERE sale_id IN (:ids)', { replacements: { ids: createdSaleIds } });
    await seq.query('DELETE FROM sale_details WHERE sale_id IN (:ids)', { replacements: { ids: createdSaleIds } });
    await seq.query('DELETE FROM inventory_movements WHERE document_number IN (SELECT sale_number FROM sales WHERE id IN (:ids))', { replacements: { ids: createdSaleIds } });
    if (cnNumberList.length > 0) {
      await seq.query('DELETE FROM inventory_movements WHERE document_number IN (:cnNums)', { replacements: { cnNums: cnNumberList } });
    }
    await seq.query('DELETE FROM sales WHERE id IN (:ids)', { replacements: { ids: createdSaleIds } });
  }
  await sequelize.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const getStock = async (productId) => {
  const res = await request(app)
    .get(`/api/products/${productId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  return res.body.data?.inventories?.reduce((s, i) => s + parseFloat(i.quantity || 0), 0) || 0;
};

const createSale = async () => {
  // Use integer USD amount to avoid decimal pollution in daily report
  return request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      customer_id: testCustomerId,
      warehouse_id: 1,
      sale_type: 'cash',
      currency_mode: 'USD',
      exchange_rate: 1,
      payment_lines: [{
        amount: 10,  // integer USD
        method: 'cash',
        currency: 'USD',
        exchange_rate: 1,
      }],
      items: [{
        product_id: testProduct.id,
        presentation_id: testProduct.presentation_id,
        quantity: 5,
        is_unit: true,
        unit_price: 2,  // integer USD: 5 × $2 = $10 total
        discount_percent: 0,
        tax_percent: 0,
      }],
    });
};

// ═══════════════════════════════════════════════════════════════════════════════
// CANCEL SALE WITH PRIOR CREDIT NOTE
// ═══════════════════════════════════════════════════════════════════════════════
describe('Cancel sale with prior credit note', () => {
  let saleId = null;
  let saleDetailId = null;
  let cnId = null;

  it('creates a cash sale (5 loose units × $2 = $10)', async () => {
    const stockBefore = await getStock(testProduct.id);
    const res = await createSale();
    expect(res.status).toBeLessThan(400);

    saleId = res.body.data?.id;
    expect(saleId).toBeTruthy();
    createdSaleIds.push(saleId);

    // Verify stock was deducted by 5
    const stockAfter = await getStock(testProduct.id);
    expect(stockBefore - stockAfter).toBeCloseTo(5, 0);
  });

  it('creates a partial credit note returning 2 of 5 units', async () => {
    const saleRes = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const detail = saleRes.body.data?.details?.[0];
    expect(detail).toBeTruthy();
    saleDetailId = detail.id;

    const res = await request(app)
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sale_id: saleId,
        reason: 'return',
        type: 'partial',
        refund_method: 'cash',
        refund_amount: 4,  // integer USD: 2 × $2 = $4
        exchange_rate: 3000,
        items: [{
          sale_detail_id: saleDetailId,
          loose_units_returned: 2,
          return_to_stock: true,
        }],
      });

    expect(res.status).toBe(201);
    cnId = res.body.data?.id;
    expect(cnId).toBeTruthy();
  });

  it('approves the credit note (returns 2 units to stock)', async () => {
    const stockBeforeApprove = await getStock(testProduct.id);

    const res = await request(app)
      .post(`/api/credit-notes/${cnId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('applied');

    // NC returned 2 units to stock
    const stockAfterApprove = await getStock(testProduct.id);
    expect(stockAfterApprove - stockBeforeApprove).toBeCloseTo(2, 0);
  });

  it('cancels the sale — stock restored minus NC-returned units (no double-return)', async () => {
    const stockBeforeCancel = await getStock(testProduct.id);

    const res = await request(app)
      .post(`/api/sales/${saleId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Test: cancel after NC' });

    expect(res.status).toBe(200);

    const stockAfterCancel = await getStock(testProduct.id);

    // Sale sold 5 loose units, NC already returned 2.
    // Cancel should return only 5 - 2 = 3 units.
    const actualReturn = stockAfterCancel - stockBeforeCancel;
    expect(actualReturn).toBeCloseTo(3, 0);

    // NOT 5 — that would be the double-return bug
    expect(actualReturn).not.toBeCloseTo(5, 0);
  });

  it('verifies the credit note was auto-cancelled', async () => {
    const res = await request(app)
      .get(`/api/credit-notes/${cnId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('verifies sale status is cancelled', async () => {
    const res = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });
});
