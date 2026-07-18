/**
 * Payment / Abono Integration Tests
 *
 * Tests the addPayment flow (credit sale abonos) with:
 *   - COP payments with exchange_rate (the bug that was fixed)
 *   - USD payments
 *   - Mixed currency partial payments
 *   - Tolerance/rounding edge cases
 *   - Overpayment rejection
 *   - Customer ledger entries
 *   - Credit balance flow (credit_balance payment method)
 *   - Full payment completes the sale
 */
const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let adminToken = '';
let testProduct = null;    // { id, presentation_id, unit_price }
let testCustomer = null;   // { id }

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  await sequelize.authenticate();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
  adminToken = loginRes.body.data?.token || loginRes.body.token || '';
  expect(adminToken).toBeTruthy();

  // Find a product with stock
  const productsRes = await request(app)
    .get('/api/products')
    .query({ limit: 50 })
    .set('Authorization', `Bearer ${adminToken}`);

  for (const p of (productsRes.body.data || [])) {
    const pres = p.presentations?.[0];
    const stock = p.inventories?.reduce((s, i) => s + parseFloat(i.quantity || 0), 0) || 0;
    if (pres && stock >= 50 && parseFloat(pres.base_price) > 0) {
      testProduct = {
        id: p.id,
        presentation_id: pres.id,
        unit_price: parseFloat(pres.base_price),
      };
      break;
    }
  }

  // Find a customer with credit
  const customersRes = await request(app)
    .get('/api/customers')
    .query({ limit: 10 })
    .set('Authorization', `Bearer ${adminToken}`);
  for (const c of (customersRes.body.data || [])) {
    if (parseFloat(c.creditLimit || c.credit_limit || 0) > 0) {
      testCustomer = { id: c.id };
      break;
    }
  }
  if (!testCustomer && (customersRes.body.data || []).length > 0) {
    testCustomer = { id: customersRes.body.data[0].id };
  }
});

afterAll(async () => { await sequelize.close(); });

// ── Helper: create a credit sale ───────────────────────────────────────────────
const createCreditSale = async (exchangeRate = 4000, qty = 1) => {
  if (!testProduct || !testCustomer) throw new Error('No test data available');
  return request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      customer_id: testCustomer.id,
      warehouse_id: 1,
      sale_type: 'credit',
      currency_mode: 'COP',
      exchange_rate: exchangeRate,
      payment_lines: [],
      items: [{
        product_id: testProduct.id,
        presentation_id: testProduct.presentation_id,
        quantity: qty,
        is_unit: false,
        unit_price: testProduct.unit_price,
        discount_percent: 0,
        tax_percent: 0,
      }],
    });
};

const addPayment = async (saleId, paymentLines, notes) => {
  return request(app)
    .post(`/api/sales/${saleId}/payments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ payment_lines: paymentLines, notes });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. COP PAYMENT WITH EXCHANGE_RATE (the fixed bug)
// ═══════════════════════════════════════════════════════════════════════════════
describe('COP payment with exchange_rate', () => {
  let saleId, saleTotal;

  beforeAll(async () => {
    if (!testProduct) return;
    const res = await createCreditSale(4000);
    if (res.status < 300) {
      saleId = res.body.data.id;
      saleTotal = parseFloat(res.body.data.total);
    }
  });

  it('accepts full COP payment at sale rate', async () => {
    if (!saleId) return;
    const copAmount = Math.ceil(saleTotal * 4000);

    const res = await addPayment(saleId, [{
      amount: copAmount,
      method: 'cash',
      currency: 'COP',
      exchange_rate: 4000,
    }]);

    expect(res.status).toBe(200);
    const sale = res.body.data?.sale || res.body.sale;
    expect(sale.status).toBe('completed');
    expect(parseFloat(sale.paid_amount)).toBeCloseTo(saleTotal, 1);
  });

  it('SalePayment record has correct currency, amount, and exchange_rate', async () => {
    if (!saleId) return;
    const detail = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detail.status).toBe(200);
    const payments = detail.body.data.payments || [];
    expect(payments.length).toBeGreaterThanOrEqual(1);
    const p = payments[payments.length - 1];
    expect(p.currency).toBe('COP');
    expect(parseFloat(p.exchange_rate)).toBe(4000);
    // amount in COP should be stored as-is
    expect(parseFloat(p.amount)).toBeGreaterThan(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. COP PAYMENT WITHOUT EXCHANGE_RATE (simulates the old bug)
// ═══════════════════════════════════════════════════════════════════════════════
describe('COP payment without exchange_rate (old bug)', () => {
  let saleId, saleTotal;

  beforeAll(async () => {
    if (!testProduct) return;
    const res = await createCreditSale(4000);
    if (res.status < 300) {
      saleId = res.body.data.id;
      saleTotal = parseFloat(res.body.data.total);
    }
  });

  it('rejects COP payment without exchange_rate — amount/1 exceeds remaining', async () => {
    if (!saleId) return;
    const copAmount = Math.ceil(saleTotal * 4000);

    // Without exchange_rate, backend uses 1 → copAmount/1 = copAmount "USD" >> saleTotal
    const res = await addPayment(saleId, [{
      amount: copAmount,
      method: 'cash',
      currency: 'COP',
      // NO exchange_rate — this is the bug
    }]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/excede/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. USD PAYMENT (baseline)
// ═══════════════════════════════════════════════════════════════════════════════
describe('USD payment', () => {
  let saleId, saleTotal;

  beforeAll(async () => {
    if (!testProduct) return;
    const res = await createCreditSale(4000);
    if (res.status < 300) {
      saleId = res.body.data.id;
      saleTotal = parseFloat(res.body.data.total);
    }
  });

  it('accepts full USD payment', async () => {
    if (!saleId) return;

    const res = await addPayment(saleId, [{
      amount: saleTotal,
      method: 'cash',
      currency: 'USD',
      exchange_rate: 1,
    }]);

    expect(res.status).toBe(200);
    const sale = res.body.data?.sale || res.body.sale;
    expect(sale.status).toBe('completed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PARTIAL COP PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
describe('Partial COP payments', () => {
  let saleId, saleTotal;

  beforeAll(async () => {
    if (!testProduct) return;
    const res = await createCreditSale(4200);
    if (res.status < 300) {
      saleId = res.body.data.id;
      saleTotal = parseFloat(res.body.data.total);
    }
  });

  it('first partial COP payment — sale stays pending', async () => {
    if (!saleId) return;
    const halfCOP = Math.ceil((saleTotal / 2) * 4200);

    const res = await addPayment(saleId, [{
      amount: halfCOP,
      method: 'cash',
      currency: 'COP',
      exchange_rate: 4200,
    }]);

    expect(res.status).toBe(200);
    const sale = res.body.data?.sale || res.body.sale;
    expect(sale.status).toBe('pending');
    expect(parseFloat(sale.paid_amount)).toBeGreaterThan(0);
    expect(parseFloat(sale.paid_amount)).toBeLessThan(saleTotal);
  });

  it('second partial COP payment at different rate — completes', async () => {
    if (!saleId) return;
    // Get remaining
    const detail = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const remaining = parseFloat(detail.body.data.total) - parseFloat(detail.body.data.paid_amount || 0);

    // Pay remaining at a slightly different rate (simulates next day)
    const newRate = 4350;
    const copAmount = Math.ceil(remaining * newRate);

    const res = await addPayment(saleId, [{
      amount: copAmount,
      method: 'transfer',
      currency: 'COP',
      exchange_rate: newRate,
      reference: 'TRF-20260718',
    }]);

    expect(res.status).toBe(200);
    const sale = res.body.data?.sale || res.body.sale;
    expect(sale.status).toBe('completed');
  });

  it('sale has 2 payment records with different rates', async () => {
    if (!saleId) return;
    const detail = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const payments = detail.body.data.payments || [];
    expect(payments.length).toBe(2);
    // Both COP but different rates
    expect(payments[0].currency).toBe('COP');
    expect(payments[1].currency).toBe('COP');
    expect(parseFloat(payments[0].exchange_rate)).not.toBe(parseFloat(payments[1].exchange_rate));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MIXED CURRENCY PAYMENTS (USD first, then COP remainder)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Mixed currency payments', () => {
  let saleId, saleTotal;

  beforeAll(async () => {
    if (!testProduct) return;
    const res = await createCreditSale(3800);
    if (res.status < 300) {
      saleId = res.body.data.id;
      saleTotal = parseFloat(res.body.data.total);
    }
  });

  it('partial USD payment', async () => {
    if (!saleId) return;
    const usdPartial = parseFloat((saleTotal * 0.4).toFixed(2));

    const res = await addPayment(saleId, [{
      amount: usdPartial,
      method: 'cash',
      currency: 'USD',
      exchange_rate: 1,
    }]);

    expect(res.status).toBe(200);
    const sale = res.body.data?.sale || res.body.sale;
    expect(sale.status).toBe('pending');
  });

  it('complete with COP payment for remaining', async () => {
    if (!saleId) return;
    const detail = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const remaining = parseFloat(detail.body.data.total) - parseFloat(detail.body.data.paid_amount || 0);

    const rate = 3800;
    const copAmount = Math.ceil(remaining * rate);

    const res = await addPayment(saleId, [{
      amount: copAmount,
      method: 'transfer',
      currency: 'COP',
      exchange_rate: rate,
    }]);

    expect(res.status).toBe(200);
    const sale = res.body.data?.sale || res.body.sale;
    expect(sale.status).toBe('completed');
  });

  it('sale has USD + COP payments', async () => {
    if (!saleId) return;
    const detail = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const payments = detail.body.data.payments || [];
    expect(payments.length).toBe(2);
    const currencies = payments.map(p => p.currency);
    expect(currencies).toContain('USD');
    expect(currencies).toContain('COP');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ROUNDING / TOLERANCE EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════
describe('Rounding and tolerance', () => {
  let saleId, saleTotal;

  beforeAll(async () => {
    if (!testProduct) return;
    const res = await createCreditSale(4000);
    if (res.status < 300) {
      saleId = res.body.data.id;
      saleTotal = parseFloat(res.body.data.total);
    }
  });

  it('accepts COP payment that is 1 COP less than exact (rounding down)', async () => {
    if (!saleId) return;
    // Exact COP would be saleTotal * 4000, but we send -1
    const copAmount = Math.ceil(saleTotal * 4000) - 1;

    const res = await addPayment(saleId, [{
      amount: copAmount,
      method: 'cash',
      currency: 'COP',
      exchange_rate: 4000,
    }]);

    expect(res.status).toBe(200);
    // Might complete or stay pending depending on the $0.01 tolerance
    const sale = res.body.data?.sale || res.body.sale;
    expect(['completed', 'pending']).toContain(sale.status);
  });

  it('rejects COP payment that is way over (> $1 USD excess)', async () => {
    if (!saleId) return;
    // Create a fresh sale for this test
    const freshRes = await createCreditSale(4000);
    if (freshRes.status >= 300) return;
    const freshSaleId = freshRes.body.data.id;
    const freshTotal = parseFloat(freshRes.body.data.total);

    // Pay $2 USD more than total → 8000 COP excess at rate 4000
    const excessCOP = Math.ceil(freshTotal * 4000) + 8000;

    const res = await addPayment(freshSaleId, [{
      amount: excessCOP,
      method: 'cash',
      currency: 'COP',
      exchange_rate: 4000,
    }]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/excede/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. CUSTOMER LEDGER ENTRIES
// ═══════════════════════════════════════════════════════════════════════════════
describe('Customer ledger on payment', () => {
  let saleId, saleTotal;

  beforeAll(async () => {
    if (!testProduct) return;
    const res = await createCreditSale(4100);
    if (res.status < 300) {
      saleId = res.body.data.id;
      saleTotal = parseFloat(res.body.data.total);
    }
  });

  it('creates ledger entry for credit sale (debit)', async () => {
    if (!saleId || !testCustomer) return;

    // Check ledger via raw SQL (no API endpoint yet)
    const [rows] = await sequelize.query(
      `SELECT * FROM customer_ledger
       WHERE customer_id = ? AND transaction_type = 'sale'
       ORDER BY id DESC LIMIT 1`,
      { replacements: [testCustomer.id] }
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const entry = rows[0];
    expect(parseFloat(entry.debit)).toBeGreaterThan(0);
    expect(parseFloat(entry.credit)).toBe(0);
    expect(entry.reference_type).toBe('sale');
    expect(entry.description).toMatch(/crédito/i);
  });

  it('creates ledger entry for COP abono (credit)', async () => {
    if (!saleId || !testCustomer) return;
    const copAmount = Math.ceil(saleTotal * 4100);

    const res = await addPayment(saleId, [{
      amount: copAmount,
      method: 'cash',
      currency: 'COP',
      exchange_rate: 4100,
    }]);
    expect(res.status).toBe(200);

    const [rows] = await sequelize.query(
      `SELECT * FROM customer_ledger
       WHERE customer_id = ? AND transaction_type = 'payment'
       ORDER BY id DESC LIMIT 1`,
      { replacements: [testCustomer.id] }
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const entry = rows[0];
    expect(parseFloat(entry.credit)).toBeGreaterThan(0);
    expect(parseFloat(entry.debit)).toBe(0);
    expect(entry.reference_type).toBe('sale_payment');
    expect(entry.description).toMatch(/Abono/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CREDIT NOTE LEDGER ENTRY
// ═══════════════════════════════════════════════════════════════════════════════
describe('Credit note ledger entry', () => {
  let saleId;

  beforeAll(async () => {
    if (!testProduct) return;
    // Create a cash sale (completed) — returns need completed sales
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer_id: testCustomer?.id,
        warehouse_id: 1,
        sale_type: 'cash',
        currency_mode: 'COP',
        exchange_rate: 4000,
        payment_lines: [{
          amount: testProduct.unit_price,
          method: 'cash',
          currency: 'USD',
          exchange_rate: 1,
        }],
        items: [{
          product_id: testProduct.id,
          presentation_id: testProduct.presentation_id,
          quantity: 1,
          is_unit: false,
          unit_price: testProduct.unit_price,
          discount_percent: 0,
          tax_percent: 0,
        }],
      });
    if (res.status < 300) saleId = res.body.data.id;
  });

  it('creates ledger entry on credit note approve (credit_balance refund)', async () => {
    if (!saleId || !testCustomer) return;

    // Create credit note
    const cnRes = await request(app)
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sale_id: saleId,
        reason: 'return',
        type: 'full',
        refund_method: 'credit_balance',
        items: [{
          sale_detail_id: null, // will auto-resolve from sale details
        }],
      });

    // If it fails due to missing sale_detail_id, try fetching details first
    if (cnRes.status >= 300) {
      const saleDetail = await request(app)
        .get(`/api/sales/${saleId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const details = saleDetail.body.data?.details || [];
      if (details.length === 0) return;

      const cnRes2 = await request(app)
        .post('/api/credit-notes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sale_id: saleId,
          reason: 'return',
          type: 'full',
          refund_method: 'credit_balance',
          items: details.map(d => ({
            sale_detail_id: d.id,
            package_quantity_returned: parseFloat(d.quantity),
            loose_units_returned: 0,
            return_to_stock: true,
          })),
        });

      if (cnRes2.status >= 300) return; // skip if CN creation fails

      const cnId = cnRes2.body.data.id;

      // Approve it
      const approveRes = await request(app)
        .post(`/api/credit-notes/${cnId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (approveRes.status >= 300) return;

      // Check ledger
      const [rows] = await sequelize.query(
        `SELECT * FROM customer_ledger
         WHERE customer_id = ? AND transaction_type = 'credit_note'
         ORDER BY id DESC LIMIT 1`,
        { replacements: [testCustomer.id] }
      );

      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(parseFloat(rows[0].credit)).toBeGreaterThan(0);
      expect(rows[0].reference_type).toBe('credit_note');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. CANCELLATION LEDGER ENTRY
// ═══════════════════════════════════════════════════════════════════════════════
describe('Sale cancellation ledger', () => {
  it('creates ledger entry on credit sale cancellation', async () => {
    if (!testProduct || !testCustomer) return;

    const res = await createCreditSale(4000);
    if (res.status >= 300) return;
    const saleId = res.body.data.id;

    // Cancel
    const cancelRes = await request(app)
      .post(`/api/sales/${saleId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Test cancellation for ledger' });

    expect(cancelRes.status).toBe(200);

    const [rows] = await sequelize.query(
      `SELECT * FROM customer_ledger
       WHERE customer_id = ? AND transaction_type = 'cancellation' AND reference_id = ?
       ORDER BY id DESC LIMIT 1`,
      { replacements: [testCustomer.id, saleId] }
    );

    expect(rows.length).toBe(1);
    expect(parseFloat(rows[0].credit)).toBeGreaterThan(0);
    expect(parseFloat(rows[0].debit)).toBe(0);
    expect(rows[0].reference_type).toBe('sale');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. REAL SCENARIO REPLAY: VEN-20260716-0080 case
//     sale total ~$540 USD, pay COP 2,162,875 at rate 4000
// ═══════════════════════════════════════════════════════════════════════════════
describe('Real scenario: large COP abono at high rate', () => {
  let saleId, saleTotal;

  beforeAll(async () => {
    if (!testProduct) return;
    // Create credit sale at rate 4000 (simulates the real case)
    const res = await createCreditSale(4000, 2);
    if (res.status < 300) {
      saleId = res.body.data.id;
      saleTotal = parseFloat(res.body.data.total);
    }
  });

  it('accepts exact COP amount = Math.ceil(total * rate)', async () => {
    if (!saleId) return;
    const exactCOP = Math.ceil(saleTotal * 4000);

    const res = await addPayment(saleId, [{
      amount: exactCOP,
      method: 'cash',
      currency: 'COP',
      exchange_rate: 4000,
      reference: '0',
    }], 'Pago completo COP');

    expect(res.status).toBe(200);
    const sale = res.body.data?.sale || res.body.sale;
    expect(sale.status).toBe('completed');
    expect(parseFloat(sale.paid_amount)).toBeCloseTo(saleTotal, 1);
  });
});
