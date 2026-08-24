/**
 * Flujo completo de compras, de punta a punta.
 *
 * proveedor → OC → aprobar → recibir parcial → recibir resto →
 * pago multi-moneda con adjudicación → deuda, saldo a favor y ledger.
 *
 * Fija el camino feliz para que las correcciones del módulo (ver
 * tmp/plan-compras-20260819.md) no lo rompan. Las fisuras conocidas están
 * abajo como it.todo: se convierten en asserts a medida que se arreglen.
 */
const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

let token = '';
const H = () => ({ Authorization: `Bearer ${token}` });
const q = async (sql, rep = []) => {
  const [rows] = await sequelize.query(sql, { replacements: rep });
  return rows;
};

let supplierId, pres, poId, detailId, poTotal;
const stamp = Date.now();

beforeAll(async () => {
  await sequelize.authenticate();
  const res = await request(app).post('/api/auth/login').send({
    username: process.env.TEST_USER || 'admin',
    password: process.env.TEST_PASSWORD,
  });
  token = res.body.data?.token || res.body.token || '';

  const sup = await request(app).post('/api/suppliers').set(H())
    .send({ name: `TEST Compras ${stamp}`, tax_id: `JT-${stamp}` });
  supplierId = sup.body.data.id;

  [pres] = await q(
    `SELECT id, product_id, units_per_package, package_cost, cost
     FROM product_presentations WHERE units_per_package > 1 ORDER BY id DESC LIMIT 1`);
});

afterAll(async () => {
  // Deshacer todo lo que creó la prueba, incluido el stock que inyectó.
  const movs = await q(
    `SELECT product_id, SUM(quantity) total FROM inventory_movements
     WHERE document_number LIKE ? GROUP BY product_id`, [`F-TEST-COMPRAS-${stamp}`]);
  for (const m of movs) {
    await q(`UPDATE inventory SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = 1`,
            [m.total, m.product_id]);
  }
  await q(`UPDATE product_presentations SET package_cost = ?, cost = ? WHERE id = ?`,
          [pres.package_cost, pres.cost, pres.id]);
  await q(`DELETE FROM inventory_movements WHERE document_number = ?`, [`F-TEST-COMPRAS-${stamp}`]);
  await q(`DELETE FROM supplier_payment_allocations WHERE payment_id IN
           (SELECT id FROM supplier_payments WHERE supplier_id = ?)`, [supplierId]);
  await q(`DELETE FROM supplier_payments WHERE supplier_id = ?`, [supplierId]);
  await q(`DELETE FROM purchase_order_details WHERE purchase_order_id IN
           (SELECT id FROM purchase_orders WHERE supplier_id = ?)`, [supplierId]);
  await q(`DELETE FROM purchase_orders WHERE supplier_id = ?`, [supplierId]);
  await q(`DELETE FROM suppliers WHERE id = ?`, [supplierId]);
  await sequelize.close();
});

const stock = async () => {
  const r = await q(`SELECT quantity q FROM inventory WHERE product_id = ? AND warehouse_id = 1`,
                    [pres.product_id]);
  return r.length ? parseFloat(r[0].q) : 0;
};

describe('Compras — flujo completo', () => {
  it('1. crea la OC en borrador con sus totales calculados', async () => {
    const res = await request(app).post('/api/purchase-orders').set(H()).send({
      supplier_id: supplierId, warehouse_id: 1, currency: 'USD',
      notes: `TEST-COMPRAS-${stamp}`,
      items: [{
        product_id: pres.product_id, presentation_id: pres.id,
        package_quantity: 10, loose_units: 0, package_cost: 25, unit_cost: 2,
      }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(parseFloat(res.body.data.total)).toBe(250);      // 10 × 25
    poId = res.body.data.id;
    detailId = res.body.data.details[0].id;
    poTotal = parseFloat(res.body.data.total);
  });

  it('2. la moneda de liquidación se infiere (USD → VES)', async () => {
    const [po] = await q(`SELECT settlement_currency FROM purchase_orders WHERE id = ?`, [poId]);
    expect(po.settlement_currency).toBe('VES');
  });

  it('3. no se puede recibir una OC en borrador', async () => {
    const res = await request(app).post(`/api/purchase-orders/${poId}/receive`).set(H())
      .send({ received_items: [{ detail_id: detailId, package_quantity: 1, loose_units: 0 }] });
    expect(res.status).toBe(400);
  });

  it('4. aprobar la pasa a "sent" y registra quién y cuándo', async () => {
    const res = await request(app).post(`/api/purchase-orders/${poId}/approve`).set(H());
    expect(res.status).toBe(200);
    const [po] = await q(`SELECT status, approved_by, approved_at FROM purchase_orders WHERE id = ?`, [poId]);
    expect(po.status).toBe('sent');
    expect(po.approved_by).not.toBeNull();
    expect(po.approved_at).not.toBeNull();
  });

  it('5. recepción parcial: suma stock, deja la OC en partially_received', async () => {
    const before = await stock();
    const res = await request(app).post(`/api/purchase-orders/${poId}/receive`).set(H())
      .send({ invoice_number: `F-TEST-COMPRAS-${stamp}`,
              received_items: [{ detail_id: detailId, package_quantity: 4, loose_units: 0 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('partially_received');
    expect(await stock() - before).toBe(4 * pres.units_per_package);
  });

  it('6. no deja recibir más de lo ordenado', async () => {
    const res = await request(app).post(`/api/purchase-orders/${poId}/receive`).set(H())
      .send({ received_items: [{ detail_id: detailId, package_quantity: 99, loose_units: 0 }] });
    expect(res.status).toBe(400);
  });

  it('7. recibir el resto la cierra en "received" con fecha de entrega', async () => {
    const before = await stock();
    const res = await request(app).post(`/api/purchase-orders/${poId}/receive`).set(H())
      .send({ invoice_number: `F-TEST-COMPRAS-${stamp}`,
              received_items: [{ detail_id: detailId, package_quantity: 6, loose_units: 0 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('received');
    expect(res.body.data.delivery_date).toBeTruthy();
    expect(await stock() - before).toBe(6 * pres.units_per_package);
  });

  it('8. el kardex registra los ingresos con referencia a la factura', async () => {
    const movs = await q(
      `SELECT movement_type, quantity, document_number FROM inventory_movements
       WHERE document_number = ? ORDER BY id`, [`F-TEST-COMPRAS-${stamp}`]);
    expect(movs.length).toBe(2);
    expect(movs.every(m => m.movement_type === 'ingreso')).toBe(true);
    expect(movs.every(m => m.document_number === `F-TEST-COMPRAS-${stamp}`)).toBe(true);
    const total = movs.reduce((s, m) => s + parseFloat(m.quantity), 0);
    expect(total).toBe(10 * pres.units_per_package);
  });

  it('9. recibir actualiza el costo de la presentación con el de la OC', async () => {
    const [p] = await q(
      `SELECT package_cost, cost, purchase_currency FROM product_presentations WHERE id = ?`, [pres.id]);
    if (p.purchase_currency === 'USD') {
      expect(parseFloat(p.package_cost)).toBe(25);   // misma moneda: se copia tal cual
      expect(parseFloat(p.cost)).toBe(2);
    } else {
      // otra moneda: se convierte, pero nunca puede quedar en cero ni negativo
      expect(parseFloat(p.package_cost)).toBeGreaterThan(0);
      expect(parseFloat(p.cost)).toBeGreaterThan(0);
    }
    expect(parseFloat(p.package_cost)).not.toBe(parseFloat(pres.package_cost));
  });

  it('10. la OC recibida aparece como deuda por su total', async () => {
    const res = await request(app).get(`/api/supplier-payments/payable-balance/${supplierId}`).set(H());
    expect(res.status).toBe(200);
    const po = res.body.data.purchase_orders.find(p => p.id === poId);
    expect(po.balance).toBe(poTotal);
  });

  it('11. un pago en la misma moneda salda la OC', async () => {
    const res = await request(app).post('/api/supplier-payments').set(H()).send({
      supplier_id: supplierId, payment_date: '2026-08-19', payment_method: 'transfer',
      amount: poTotal, currency: 'USD',
      allocations: [{ purchase_order_id: poId, allocated_amount: poTotal }],
    });
    expect(res.status).toBe(201);

    const bal = await request(app).get(`/api/supplier-payments/payable-balance/${supplierId}`).set(H());
    const po = bal.body.data.purchase_orders.find(p => p.id === poId);
    expect(po.balance).toBeCloseTo(0, 2);
  });

  it('12. un pago en otra moneda se congela convertido, no 1:1', async () => {
    const po2 = await request(app).post('/api/purchase-orders').set(H()).send({
      supplier_id: supplierId, warehouse_id: 1, currency: 'USD', notes: `TEST-COMPRAS-${stamp}`,
      items: [{ product_id: pres.product_id, presentation_id: pres.id,
                package_quantity: 1, loose_units: 0, package_cost: 100, unit_cost: 10 }],
    });
    const res = await request(app).post('/api/supplier-payments').set(H()).send({
      supplier_id: supplierId, payment_date: '2026-08-19', payment_method: 'transfer',
      amount: 100000, currency: 'COP',
      allocations: [{ purchase_order_id: po2.body.data.id, allocated_amount: 100000 }],
    });
    expect(res.status).toBe(201);

    const [alloc] = await q(
      `SELECT allocated_amount, allocated_amount_po_currency FROM supplier_payment_allocations
       WHERE purchase_order_id = ?`, [po2.body.data.id]);
    // 100.000 COP no pueden valer 100.000 USD: si son iguales, la conversión falló en silencio
    expect(parseFloat(alloc.allocated_amount_po_currency))
      .not.toBeCloseTo(parseFloat(alloc.allocated_amount), 2);
    expect(parseFloat(alloc.allocated_amount_po_currency)).toBeGreaterThan(0);
  });

  it('13. anular un pago lo saca del cálculo de deuda', async () => {
    const pay = await request(app).post('/api/supplier-payments').set(H()).send({
      supplier_id: supplierId, payment_date: '2026-08-19', payment_method: 'cash',
      amount: 30, currency: 'USD',
      allocations: [{ purchase_order_id: poId, allocated_amount: 30 }],
    });
    expect(pay.status).toBe(201);

    const conPago = await request(app).get(`/api/supplier-payments/payable-balance/${supplierId}`).set(H());
    const antes = conPago.body.data.purchase_orders.find(p => p.id === poId).balance;

    await request(app).post(`/api/supplier-payments/${pay.body.data.id}/cancel`).set(H())
      .send({ reason: 'test' });

    const sinPago = await request(app).get(`/api/supplier-payments/payable-balance/${supplierId}`).set(H());
    const despues = sinPago.body.data.purchase_orders.find(p => p.id === poId).balance;
    expect(despues).toBeCloseTo(antes + 30, 2);
  });

  it('14. el estado de cuenta del proveedor responde con sus categorías', async () => {
    const res = await request(app).get(`/api/suppliers/${supplierId}/ledger`).set(H());
    expect(res.status).toBe(200);
    expect(res.body.data.categories).toBeDefined();
  });
});

// ─── Fisuras detectadas el 2026-08-19, pendientes de corrección ───────────────
// Convertir cada it.todo en un it() cuando se arregle. Detalle y evidencia en
// tmp/plan-compras-20260819.md
describe('Compras — fisuras conocidas (pendientes)', () => {
  it.todo('rechaza cantidades y costos negativos al crear la OC');
  it.todo('rechaza líneas con cantidad 0 o costo 0');
  it.todo('rechaza una presentación que no pertenece al producto');
  it.todo('no permite crear la OC sin fecha de entrega esperada → hoy da 500');
  it.todo('recibir dos veces en paralelo no duplica el stock (falta LOCK.UPDATE)');
  it.todo('recibir con costo 0 no pone en cero el costo de la presentación');
  it.todo('recibir el mismo lote en dos entregas no revienta por unique de batch_number');
  it.todo('el movimiento de kardex queda enlazado al lote que creó (batch_id)');
  it.todo('cancelar una OC parcialmente recibida revierte el stock o se prohíbe');
  it.todo('no se puede adjudicar un pago a una OC cancelada o en borrador');
  it.todo('moneda y método de pago inválidos devuelven 400, no 500');
  it.todo('PUT de un pago con amount distinto devuelve 400 en vez de ignorarlo');
  it.todo('no se puede editar un pago anulado');
  it.todo('una OC parcialmente recibida solo adeuda la porción recibida');
  it.todo('el ledger y el payable-balance dan el mismo número');
});
