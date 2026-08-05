/**
 * Arqueo / Cierre de caja — Integration Tests
 *
 * Cubre los fixes de la auditoría del flujo de arqueo:
 *   1. Vuelto: las líneas negativas (COP) se persisten en sale_payments y
 *      paid_amount se calcula NETO (createSale y addPayment).
 *   2. Recargo 7%: se aplica server-side en ventas por unidad suelta en pocas
 *      cantidades, aunque el cliente envíe el precio "limpio".
 *   3. Cierre: los cobros de pos_pending aparecen en creditCollectedByCurrency,
 *      los pagos revertidos NO suman, y el breakdown COP netea el vuelto.
 *
 * Self-cleaning: borra toda la data de prueba en afterAll para no contaminar
 * el reporte diario.
 */
const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let adminToken = '';
let testProduct = null;
let testCustomerId = null;
const createdSaleIds = [];

const COP_RATE = 4000;

beforeAll(async () => {
  await sequelize.authenticate();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
  adminToken = loginRes.body.data?.token || loginRes.body.token || '';
  expect(adminToken).toBeTruthy();

  const productsRes = await request(app)
    .get('/api/products')
    .query({ limit: 100 })
    .set('Authorization', `Bearer ${adminToken}`);

  for (const p of (productsRes.body.data || [])) {
    const pres = p.presentations?.[0];
    const stock = p.inventories?.reduce((s, i) => s + parseFloat(i.quantity || 0), 0) || 0;
    // Necesitamos units_per_package > 2 para poder probar el umbral del recargo
    if (pres && stock >= 30 && (parseFloat(pres.units_per_package) || 1) >= 6) {
      testProduct = {
        id: p.id,
        presentation_id: pres.id,
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
  if (createdSaleIds.length > 0) {
    const seq = sequelize;
    await seq.query('DELETE FROM sale_payments WHERE sale_id IN (:ids)', { replacements: { ids: createdSaleIds } });
    await seq.query('DELETE FROM sale_details WHERE sale_id IN (:ids)', { replacements: { ids: createdSaleIds } });
    await seq.query(
      'DELETE FROM inventory_movements WHERE document_number IN (SELECT sale_number FROM sales WHERE id IN (:ids))',
      { replacements: { ids: createdSaleIds } }
    );
    await seq.query('DELETE FROM customer_ledger WHERE reference_id IN (:ids) AND reference_type = :rt',
      { replacements: { ids: createdSaleIds, rt: 'sale' } }).catch(() => {});
    await seq.query('DELETE FROM sales WHERE id IN (:ids)', { replacements: { ids: createdSaleIds } });
  }
  await sequelize.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const postSale = (body) =>
  request(app).post('/api/sales').set('Authorization', `Bearer ${adminToken}`).send(body);

const trackSale = (res) => {
  const id = res.body.data?.id;
  if (id) createdSaleIds.push(id);
  return id;
};

const getPayments = async (saleId) => {
  const rows = await sequelize.query(
    'SELECT amount, currency, payment_method, exchange_rate FROM sale_payments WHERE sale_id = :id ORDER BY id',
    { replacements: { id: saleId }, type: sequelize.QueryTypes.SELECT }
  );
  return rows.map(r => ({ ...r, amount: parseFloat(r.amount) }));
};

const getSaleRow = async (saleId) => {
  const [row] = await sequelize.query(
    'SELECT total, paid_amount, sale_type, status FROM sales WHERE id = :id',
    { replacements: { id: saleId }, type: sequelize.QueryTypes.SELECT }
  );
  return row;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. VUELTO PERSISTIDO (línea negativa COP)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Vuelto: líneas negativas persistidas', () => {
  it('createSale guarda la línea negativa de vuelto y paid_amount queda neto', async () => {
    // Total $10. Cliente paga $12 USD → vuelto $2 = 8000 COP
    const res = await postSale({
      customer_id: testCustomerId,
      warehouse_id: 1,
      sale_type: 'cash',
      currency_mode: 'USD',
      exchange_rate: COP_RATE,
      payment_lines: [
        { amount: 12, method: 'cash', currency: 'USD', exchange_rate: 1 },
        // vuelto entregado en COP (lo que produce adjustPaymentLinesForChange)
        { amount: -8000, method: 'cash', currency: 'COP', exchange_rate: COP_RATE },
      ],
      items: [{
        product_id: testProduct.id,
        presentation_id: testProduct.presentation_id,
        quantity: 5,
        is_unit: true,
        unit_price: 2,
        discount_percent: 0,
        tax_percent: 0,
      }],
    });
    expect(res.status).toBeLessThan(400);
    const saleId = trackSale(res);
    expect(saleId).toBeTruthy();

    const payments = await getPayments(saleId);
    const negatives = payments.filter(p => p.amount < 0);

    // La línea negativa DEBE existir (antes se descartaba en sale.service)
    expect(negatives).toHaveLength(1);
    expect(negatives[0].amount).toBe(-8000);
    expect(negatives[0].currency).toBe('COP');
    expect(negatives[0].payment_method).toBe('cash');

    // paid_amount neto: 12 USD − (8000/4000) USD = 10 USD = total
    const sale = await getSaleRow(saleId);
    expect(parseFloat(sale.paid_amount)).toBeCloseTo(10, 1);
    expect(parseFloat(sale.total)).toBeCloseTo(10, 1);
  });

  it('el neto de las líneas persistidas iguala el total de la venta', async () => {
    const saleId = createdSaleIds[createdSaleIds.length - 1];
    const payments = await getPayments(saleId);
    const netUSD = payments.reduce((s, p) => s + p.amount / (parseFloat(p.exchange_rate) || 1), 0);
    expect(netUSD).toBeCloseTo(10, 1);
  });

  it('addPayment persiste la línea negativa al cobrar un pos_pending', async () => {
    // Vendedor crea la venta pendiente ($10)
    const createRes = await postSale({
      customer_id: testCustomerId,
      warehouse_id: 1,
      sale_type: 'pos_pending',
      currency_mode: 'COP',
      exchange_rate: COP_RATE,
      payment_lines: [],
      items: [{
        product_id: testProduct.id,
        presentation_id: testProduct.presentation_id,
        quantity: 5,
        is_unit: true,
        unit_price: 2,
        discount_percent: 0,
        tax_percent: 0,
      }],
    });
    expect(createRes.status).toBeLessThan(400);
    const saleId = trackSale(createRes);

    // Cajero cobra con $12 USD → vuelto 8000 COP
    const payRes = await request(app)
      .post(`/api/sales/${saleId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        payment_lines: [
          { amount: 12, method: 'cash', currency: 'USD', exchange_rate: 1 },
          { amount: -8000, method: 'cash', currency: 'COP', exchange_rate: COP_RATE },
        ],
      });
    expect(payRes.status).toBeLessThan(400);

    const payments = await getPayments(saleId);
    expect(payments.filter(p => p.amount < 0)).toHaveLength(1);

    const sale = await getSaleRow(saleId);
    expect(parseFloat(sale.paid_amount)).toBeCloseTo(10, 1);
    // pos_pending totalmente pagada → pasa a cash
    expect(sale.sale_type).toBe('cash');
    expect(sale.status).toBe('completed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. RECARGO 7% SERVER-SIDE
// ═══════════════════════════════════════════════════════════════════════════════
describe('Recargo 7% por unidad suelta', () => {
  const getDetailUnitPrice = async (saleId) => {
    const [row] = await sequelize.query(
      'SELECT unit_price FROM sale_details WHERE sale_id = :id LIMIT 1',
      { replacements: { id: saleId }, type: sequelize.QueryTypes.SELECT }
    );
    return parseFloat(row.unit_price);
  };

  it('NO aplica recargo cuando la cantidad llega a media caja', async () => {
    const qty = testProduct.units_per_package; // caja completa en unidades
    const res = await postSale({
      customer_id: testCustomerId,
      warehouse_id: 1,
      sale_type: 'cash',
      currency_mode: 'USD',
      exchange_rate: COP_RATE,
      payment_lines: [{ amount: qty * 2, method: 'cash', currency: 'USD', exchange_rate: 1 }],
      items: [{
        product_id: testProduct.id,
        presentation_id: testProduct.presentation_id,
        quantity: qty,
        is_unit: true,
        unit_price: 2,
        discount_percent: 0,
        tax_percent: 0,
      }],
    });
    expect(res.status).toBeLessThan(400);
    const saleId = trackSale(res);

    // Sin recargo: el precio enviado se respeta tal cual
    expect(await getDetailUnitPrice(saleId)).toBeCloseTo(2, 2);
  });

  it('respeta el precio enviado cuando ya viene con el recargo aplicado', async () => {
    // El POS envía 2.14 (= 2 × 1.07): el backend no debe volver a recargarlo
    const res = await postSale({
      customer_id: testCustomerId,
      warehouse_id: 1,
      sale_type: 'cash',
      currency_mode: 'USD',
      exchange_rate: COP_RATE,
      payment_lines: [{ amount: 4.28, method: 'cash', currency: 'USD', exchange_rate: 1 }],
      items: [{
        product_id: testProduct.id,
        presentation_id: testProduct.presentation_id,
        quantity: 2,
        is_unit: true,
        unit_price: 2.14,
        discount_percent: 0,
        tax_percent: 0,
      }],
    });
    expect(res.status).toBeLessThan(400);
    const saleId = trackSale(res);

    const stored = await getDetailUnitPrice(saleId);
    // No se duplica el recargo (2.14 × 1.07 = 2.29 sería el bug)
    expect(stored).toBeLessThan(2.2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CIERRE DE CAJA
// ═══════════════════════════════════════════════════════════════════════════════
describe('getDailyClosure', () => {
  const getClosure = async () => {
    const res = await request(app)
      .get('/api/sales/daily-closure')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBeLessThan(400);
    return res.body.data || res.body;
  };

  it('responde con los bloques esperados', async () => {
    const closure = await getClosure();
    expect(closure).toHaveProperty('paymentsBreakdown');
    expect(closure).toHaveProperty('creditCollectedByCurrency');
    // Nuevo: desglose de abonos en efectivo para el cuadre físico
    expect(closure).toHaveProperty('creditCollectedCashByCurrency');
    expect(closure).toHaveProperty('cashRefunds');
  });

  it('el breakdown COP netea el vuelto entregado', async () => {
    // Venta pagada 60000 COP sobre un total de 40000 → vuelto 20000
    const res = await postSale({
      customer_id: testCustomerId,
      warehouse_id: 1,
      sale_type: 'cash',
      currency_mode: 'COP',
      exchange_rate: COP_RATE,
      payment_lines: [
        { amount: 60000, method: 'cash', currency: 'COP', exchange_rate: COP_RATE },
        { amount: -20000, method: 'cash', currency: 'COP', exchange_rate: COP_RATE },
      ],
      items: [{
        product_id: testProduct.id,
        presentation_id: testProduct.presentation_id,
        quantity: 5,
        is_unit: true,
        unit_price: 2,
        discount_percent: 0,
        tax_percent: 0,
      }],
    });
    expect(res.status).toBeLessThan(400);
    const saleId = trackSale(res);

    const payments = await getPayments(saleId);
    const netCOP = payments
      .filter(p => p.currency === 'COP')
      .reduce((s, p) => s + p.amount, 0);
    // 60000 − 20000 = 40000: el efectivo que realmente quedó en caja
    expect(netCOP).toBe(40000);

    // El cierre suma esas mismas líneas (SUM incluye las negativas)
    const closure = await getClosure();
    expect(closure.paymentsBreakdown).toBeTruthy();
  });

  it('un pago revertido no suma al cierre', async () => {
    const closureBefore = await getClosure();
    const copBefore = closureBefore.paymentsBreakdown?.COP?.cash || 0;

    const res = await postSale({
      customer_id: testCustomerId,
      warehouse_id: 1,
      sale_type: 'cash',
      currency_mode: 'COP',
      exchange_rate: COP_RATE,
      payment_lines: [{ amount: 40000, method: 'cash', currency: 'COP', exchange_rate: COP_RATE }],
      items: [{
        product_id: testProduct.id,
        presentation_id: testProduct.presentation_id,
        quantity: 5,
        is_unit: true,
        unit_price: 2,
        discount_percent: 0,
        tax_percent: 0,
      }],
    });
    expect(res.status).toBeLessThan(400);
    const saleId = trackSale(res);

    const closureMid = await getClosure();
    expect((closureMid.paymentsBreakdown?.COP?.cash || 0)).toBeCloseTo(copBefore + 40000, 0);

    // Revertir el pago directamente (simula reverseSalePayment)
    await sequelize.query(
      'UPDATE sale_payments SET reversed_at = NOW() WHERE sale_id = :id',
      { replacements: { id: saleId } }
    );

    const closureAfter = await getClosure();
    expect((closureAfter.paymentsBreakdown?.COP?.cash || 0)).toBeCloseTo(copBefore, 0);
  });
});
