/**
 * Customer Statement Balance — Integration Test
 * Verifica que el balance del estado de cuenta solo refleja ventas a crédito,
 * no pagos de ventas en efectivo (bug fix: filtrar payments por sale_type='credit').
 *
 * Setup: Requiere BD MySQL corriendo (usa la config del app).
 *        NO necesita el servidor HTTP — accede a los modelos directamente.
 *
 * Run:   cd backend && node tests/customer.statement.test.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const { Customer, Sale, SalePayment } = require('../models');
const { Op } = require('sequelize');

// ─── helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const TEST_PREFIX = 'TS_';

function ok(name, cond, info = '') {
  if (cond) {
    console.log(`  ✅  ${name}`);
    passed++;
  } else {
    console.log(`  ❌  ${name}${info ? ' — ' + info : ''}`);
    failed++;
  }
}

async function cleanup(customerId) {
  if (!customerId) return;
  // Delete in FK order: payments → sales → customer
  const sales = await Sale.findAll({ where: { customer_id: customerId }, attributes: ['id'] });
  const saleIds = sales.map(s => s.id);
  if (saleIds.length) {
    await SalePayment.destroy({ where: { sale_id: { [Op.in]: saleIds } } });
    await Sale.destroy({ where: { id: { [Op.in]: saleIds } } });
  }
  await Customer.destroy({ where: { id: customerId } });
}

// ─── helpers: replicate the statement balance logic ────────────────────────────
async function computeBalance(customerId, { filterCreditOnly }) {
  // Fetch credit sales (for total_invoiced)
  const creditSales = await Sale.findAll({
    where: { customer_id: customerId, sale_type: 'credit', status: { [Op.notIn]: ['cancelled'] } },
    attributes: ['id', 'total', 'exchange_rate']
  });

  // Fetch payments — with or without the credit-only filter
  const paymentIncludeWhere = filterCreditOnly
    ? { customer_id: customerId, sale_type: 'credit' }
    : { customer_id: customerId };

  const payments = await SalePayment.findAll({
    include: [{
      model: Sale,
      as: 'sale',
      where: paymentIncludeWhere,
      attributes: ['id', 'sale_number', 'exchange_rate']
    }],
    attributes: ['id', 'amount', 'currency', 'exchange_rate']
  });

  let total_invoiced_usd = 0;
  for (const s of creditSales) {
    total_invoiced_usd += parseFloat(s.total || 0);
  }

  let total_paid_usd = 0;
  for (const p of payments) {
    const amt = parseFloat(p.amount || 0);
    const currency = p.currency || 'USD';
    const rate = parseFloat(p.exchange_rate && parseFloat(p.exchange_rate) !== 1
      ? p.exchange_rate
      : (p.sale?.exchange_rate || 1));

    if (currency === 'USD') {
      total_paid_usd += amt;
    } else if (currency === 'COP') {
      total_paid_usd += amt / rate;
    } else {
      total_paid_usd += amt;
    }
  }

  return {
    total_invoiced: parseFloat(total_invoiced_usd.toFixed(4)),
    total_paid: parseFloat(total_paid_usd.toFixed(4)),
    balance: parseFloat(Math.max(0, total_invoiced_usd - total_paid_usd).toFixed(4))
  };
}

// ─── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n================================================');
  console.log('  Customer Statement Balance — Integration Test');
  console.log('================================================');

  // 1. Connectivity
  console.log('\n1. DATABASE CONNECTIVITY');
  try {
    await sequelize.authenticate();
    ok('Database reachable', true);
  } catch (err) {
    ok('Database reachable', false, err.message);
    process.exit(1);
  }

  // 2. Prerequisites: get an existing warehouse_id and user_id
  console.log('\n2. PREREQUISITES');
  let warehouseId, userId;
  try {
    const [wRows] = await sequelize.query('SELECT id FROM warehouses LIMIT 1');
    const [uRows] = await sequelize.query('SELECT id FROM users LIMIT 1');
    if (!wRows.length || !uRows.length) throw new Error('No warehouse or user found');
    warehouseId = wRows[0].id;
    userId = uRows[0].id;
    ok(`Warehouse found (id=${warehouseId})`, true);
    ok(`User found (id=${userId})`, true);
  } catch (err) {
    ok('Get warehouse/user', false, err.message);
    process.exit(1);
  }

  // 3. Setup test data
  console.log('\n3. TEST DATA SETUP');
  let customerId = null;
  let creditSaleId = null;
  let cashSaleId = null;

  try {
    const ts = String(Date.now()).slice(-8); // 8 digits to stay within VARCHAR(20)
    const customer = await Customer.create({
      code: `${TEST_PREFIX}${ts}`,
      type: 'natural',
      documentType: 'V',
      documentNumber: `TEST${ts}`,
      firstName: 'Test',
      lastName: 'Statement',
    });
    customerId = customer.id;
    ok(`Customer created (id=${customerId})`, true);

    // Credit sale: $100 USD
    const creditSale = await Sale.create({
      sale_number: `${TEST_PREFIX}CRED_${ts}`,
      customer_id: customerId,
      warehouse_id: warehouseId,
      user_id: userId,
      sale_type: 'credit',
      exchange_rate: 4000,
      subtotal: 100,
      tax_amount: 0,
      discount_amount: 0,
      total: 100,
      status: 'completed',
      created_by: userId,
    });
    creditSaleId = creditSale.id;
    ok(`Credit sale created ($100, id=${creditSaleId})`, true);

    // Cash sale: $50 USD
    const cashSale = await Sale.create({
      sale_number: `${TEST_PREFIX}CASH_${ts}`,
      customer_id: customerId,
      warehouse_id: warehouseId,
      user_id: userId,
      sale_type: 'cash',
      payment_method: 'cash',
      exchange_rate: 4000,
      subtotal: 50,
      tax_amount: 0,
      discount_amount: 0,
      total: 50,
      status: 'completed',
      created_by: userId,
    });
    cashSaleId = cashSale.id;
    ok(`Cash sale created ($50, id=${cashSaleId})`, true);

    // Payment $30 on credit sale
    await SalePayment.create({
      sale_id: creditSaleId,
      payment_method: 'cash',
      currency: 'USD',
      exchange_rate: 1,
      amount: 30,
      created_by: userId,
    });
    ok('Payment $30 on credit sale', true);

    // Payment $50 on cash sale
    await SalePayment.create({
      sale_id: cashSaleId,
      payment_method: 'cash',
      currency: 'USD',
      exchange_rate: 1,
      amount: 50,
      created_by: userId,
    });
    ok('Payment $50 on cash sale', true);
  } catch (err) {
    ok('Test data setup', false, err.message);
    await cleanup(customerId);
    process.exit(1);
  }

  // 4. Balance calculation tests
  console.log('\n4. BALANCE CALCULATION');

  // 4a. Correct behavior (credit-only filter — the fix)
  const fixed = await computeBalance(customerId, { filterCreditOnly: true });
  console.log(`     [fixed]  invoiced=$${fixed.total_invoiced}  paid=$${fixed.total_paid}  balance=$${fixed.balance}`);
  ok('total_invoiced = $100 (only credit sale)', fixed.total_invoiced === 100);
  ok('total_paid = $30 (only credit sale payment)', fixed.total_paid === 30);
  ok('balance = $70 (correct debt)', Math.abs(fixed.balance - 70) < 0.01);

  // 4b. Buggy behavior (no filter — includes cash payments)
  const buggy = await computeBalance(customerId, { filterCreditOnly: false });
  console.log(`     [buggy]  invoiced=$${buggy.total_invoiced}  paid=$${buggy.total_paid}  balance=$${buggy.balance}`);
  ok('Bug reproduced: total_paid inflated by cash payment', buggy.total_paid > fixed.total_paid);
  ok('Bug reproduced: balance would be $20 (wrong)', Math.abs(buggy.balance - 20) < 0.01);

  // 5. Cleanup
  console.log('\n5. CLEANUP');
  try {
    await cleanup(customerId);
    ok('Test data removed', true);
  } catch (err) {
    ok('Test data removed', false, err.message);
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n================================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('================================================\n');
  await sequelize.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\nFATAL:', err.message);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
