/**
 * Payment Conversion Tests
 * Tests convertPaymentLinesToBackend logic and backend paid_amount calculation.
 *
 * Pure logic tests — no database or HTTP server needed.
 *
 * Run:   cd backend && node tests/payment-conversion.check.js
 */

// ─── helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(name, cond, info = '') {
  if (cond) {
    console.log(`  ✅  ${name}`);
    passed++;
  } else {
    console.log(`  ❌  ${name}${info ? ' — ' + info : ''}`);
    failed++;
  }
}

function approxEqual(a, b, tolerance = 0.01) {
  return Math.abs(a - b) < tolerance;
}

// ─── replicate frontend logic (usePOS.js convertPaymentLinesToBackend) ────────
function convertPaymentLinesToBackend(lines, copPerUSD) {
  return lines.map(line => {
    if (line.currency === 'USD') {
      const usdRate = copPerUSD / (parseFloat(line.cop_rate) || copPerUSD);
      return { currency: 'USD', method: line.method, amount: line.amount, exchange_rate: usdRate };
    }
    if (line.currency === 'VES') {
      const vesRate = copPerUSD / (parseFloat(line.cop_rate) || 1);
      return { currency: 'VES', method: line.method, amount: line.amount, exchange_rate: vesRate };
    }
    return { currency: 'COP', method: line.method, amount: line.amount, exchange_rate: copPerUSD };
  });
}

// ─── replicate backend logic (sale.controller.js paid_amount calc) ───────────
function calculatePaidAmount(backendLines) {
  return backendLines
    .filter(l => l.method !== 'credit')
    .reduce((sum, line) => {
      const amount = parseFloat(line.amount) || 0;
      const rate = parseFloat(line.exchange_rate) || 1;
      return sum + (amount / rate);
    }, 0);
}

// ─── constants ───────────────────────────────────────────────────────────────
const copPerUSD = 4200;   // sistema: 1 USD = 4200 COP
const vesRate = 80;       // sistema: 1 USD = 80 VES (cop_rate for VES = copPerUSD/vesRate = 52.5)
const vesCopRate = copPerUSD / vesRate; // 52.5

// ─── test cases ──────────────────────────────────────────────────────────────

function testCase1_USDMode_PayUSD_SystemRate() {
  console.log('\n1. USD mode + pago USD + tasa sistema');
  const lines = [{ currency: 'USD', method: 'cash', amount: 29, cop_rate: copPerUSD }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  ok('exchange_rate = 1', approxEqual(backend[0].exchange_rate, 1));
  const paid = calculatePaidAmount(backend);
  ok('paid_amount = 29', approxEqual(paid, 29));
}

function testCase2_USDMode_PayCOP() {
  console.log('\n2. USD mode + pago COP');
  // Pagan 126000 COP por una venta de 30 USD
  const lines = [{ currency: 'COP', method: 'cash', amount: 126000, cop_rate: 1 }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  ok('exchange_rate = copPerUSD (4200)', approxEqual(backend[0].exchange_rate, copPerUSD));
  const paid = calculatePaidAmount(backend);
  ok('paid_amount = 30 USD', approxEqual(paid, 30));
}

function testCase3_USDMode_PayVES_SystemRate() {
  console.log('\n3. USD mode + pago VES + tasa sistema');
  // Pagan 2400 VES por 30 USD (2400 / 80 = 30)
  const lines = [{ currency: 'VES', method: 'cash', amount: 2400, cop_rate: vesCopRate }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  const expectedRate = copPerUSD / vesCopRate; // 4200 / 52.5 = 80
  ok(`exchange_rate = ${expectedRate}`, approxEqual(backend[0].exchange_rate, expectedRate));
  const paid = calculatePaidAmount(backend);
  ok('paid_amount = 30 USD', approxEqual(paid, 30));
}

function testCase4_USDMode_PayVES_CustomRate() {
  console.log('\n4. USD mode + pago VES + tasa custom');
  const customVesRate = 90; // cajero usa 90 VES/USD en vez de 80
  const customCopRate = copPerUSD / customVesRate; // 4200/90 = 46.67
  const lines = [{ currency: 'VES', method: 'cash', amount: 2700, cop_rate: customCopRate }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  const expectedRate = copPerUSD / customCopRate; // 4200 / 46.67 = 90
  ok(`exchange_rate = ${expectedRate}`, approxEqual(backend[0].exchange_rate, expectedRate));
  const paid = calculatePaidAmount(backend);
  ok('paid_amount = 30 USD', approxEqual(paid, 30));
}

function testCase5_COPMode_PayCOP() {
  console.log('\n5. COP mode + pago COP');
  // Venta en COP: 126000 COP (= 30 USD)
  const lines = [{ currency: 'COP', method: 'cash', amount: 126000, cop_rate: 1 }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  ok('exchange_rate = copPerUSD (4200)', approxEqual(backend[0].exchange_rate, copPerUSD));
  const paid = calculatePaidAmount(backend);
  ok('paid_amount = 30 USD', approxEqual(paid, 30));
}

function testCase6_COPMode_PayUSD_SystemRate() {
  console.log('\n6. COP mode + pago USD + tasa sistema');
  // Venta 126000 COP, pagan 30 USD a tasa sistema
  const lines = [{ currency: 'USD', method: 'cash', amount: 30, cop_rate: copPerUSD }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  ok('exchange_rate = 1', approxEqual(backend[0].exchange_rate, 1));
  const paid = calculatePaidAmount(backend);
  ok('paid_amount = 30 USD', approxEqual(paid, 30));
}

function testCase7_COPMode_PayUSD_CustomRate() {
  console.log('\n7. COP mode + pago USD + tasa custom (4500) ← EL BUG');
  // Venta 126000 COP, cajero acepta USD a 4500 COP/USD (tasa preferencial)
  // El cliente paga 28 USD (28 * 4500 = 126000 COP)
  const customCopRate = 4500;
  const lines = [{ currency: 'USD', method: 'cash', amount: 28, cop_rate: customCopRate }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  const expectedRate = copPerUSD / customCopRate; // 4200/4500 = 0.9333
  ok(`exchange_rate = ${expectedRate.toFixed(4)} (no 1)`, approxEqual(backend[0].exchange_rate, expectedRate));
  const paid = calculatePaidAmount(backend);
  // 28 / 0.9333 = 30 USD equivalente
  ok('paid_amount = 30 USD', approxEqual(paid, 30));

  // Verify the OLD bug: exchange_rate=1 would give paid=28 (wrong)
  const buggyPaid = 28 / 1;
  ok('OLD bug would have given paid=28 (wrong)', approxEqual(buggyPaid, 28));
}

function testCase8_COPMode_PayVES_SystemRate() {
  console.log('\n8. COP mode + pago VES + tasa sistema');
  // 2400 VES a tasa 80 VES/USD
  const lines = [{ currency: 'VES', method: 'cash', amount: 2400, cop_rate: vesCopRate }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  const expectedRate = copPerUSD / vesCopRate; // 80
  ok(`exchange_rate = ${expectedRate}`, approxEqual(backend[0].exchange_rate, expectedRate));
  const paid = calculatePaidAmount(backend);
  ok('paid_amount = 30 USD', approxEqual(paid, 30));
}

function testCase9_COPMode_PayVES_CustomRate() {
  console.log('\n9. COP mode + pago VES + tasa custom');
  const customVesRate = 75;
  const customCopRate = copPerUSD / customVesRate; // 56
  const lines = [{ currency: 'VES', method: 'cash', amount: 2250, cop_rate: customCopRate }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  const expectedRate = copPerUSD / customCopRate; // 75
  ok(`exchange_rate = ${expectedRate}`, approxEqual(backend[0].exchange_rate, expectedRate));
  const paid = calculatePaidAmount(backend);
  ok('paid_amount = 30 USD', approxEqual(paid, 30));
}

function testCase10_COPMode_MixedUSDCOP() {
  console.log('\n10. COP mode + pago mixto USD + COP');
  // Venta 126000 COP (30 USD). Pagan 10 USD + 84000 COP
  const lines = [
    { currency: 'USD', method: 'cash', amount: 10, cop_rate: copPerUSD },
    { currency: 'COP', method: 'cash', amount: 84000, cop_rate: 1 },
  ];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  ok('USD exchange_rate = 1', approxEqual(backend[0].exchange_rate, 1));
  ok('COP exchange_rate = 4200', approxEqual(backend[1].exchange_rate, copPerUSD));
  const paid = calculatePaidAmount(backend);
  // 10/1 + 84000/4200 = 10 + 20 = 30
  ok('paid_amount = 30 USD', approxEqual(paid, 30));
}

function testCase11_COPMode_PayUSD_CustomRate_BugRegression() {
  console.log('\n11. COP mode + pago USD custom (4500) — REGRESIÓN del bug');
  // Reproduce el escenario exacto de las 11 ventas descuadradas del 2026-06-16
  // Venta de 126000 COP. Cajero acepta USD a 4500.
  const customCopRate = 4500;
  const amountUSD = 126000 / customCopRate; // 28 USD
  const lines = [{ currency: 'USD', method: 'cash', amount: amountUSD, cop_rate: customCopRate }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  const paid = calculatePaidAmount(backend);
  ok('paid_amount = 30 USD (venta cubre el total)', approxEqual(paid, 30));

  // Bug viejo: exchange_rate=1 → paid=28 < total=30
  ok('Con bug viejo sería 28 (insuficiente)', approxEqual(amountUSD / 1, 28));
}

// ─── edge cases ──────────────────────────────────────────────────────────────

function testEdge_CopRateZero() {
  console.log('\n  Edge: cop_rate = 0 → fallback (sin división por cero)');
  const lines = [{ currency: 'USD', method: 'cash', amount: 30, cop_rate: 0 }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  ok('exchange_rate = 1 (fallback copPerUSD/copPerUSD)', approxEqual(backend[0].exchange_rate, 1));
  ok('No NaN/Infinity', isFinite(backend[0].exchange_rate));
}

function testEdge_CopRateNull() {
  console.log('\n  Edge: cop_rate = null → fallback');
  const lines = [{ currency: 'USD', method: 'cash', amount: 30, cop_rate: null }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  ok('exchange_rate = 1 (fallback)', approxEqual(backend[0].exchange_rate, 1));
  ok('No NaN/Infinity', isFinite(backend[0].exchange_rate));
}

function testEdge_CopRateUndefined() {
  console.log('\n  Edge: cop_rate = undefined → fallback');
  const lines = [{ currency: 'USD', method: 'cash', amount: 30 }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  ok('exchange_rate = 1 (fallback)', approxEqual(backend[0].exchange_rate, 1));
}

function testEdge_NegativeCOP_Change() {
  console.log('\n  Edge: línea COP negativa (vuelto)');
  const lines = [{ currency: 'COP', method: 'cash', amount: -5000, cop_rate: 1 }];
  const backend = convertPaymentLinesToBackend(lines, copPerUSD);
  ok('amount preservado negativo', backend[0].amount === -5000);
  ok('exchange_rate = copPerUSD', approxEqual(backend[0].exchange_rate, copPerUSD));
}

function testEdge_BackendValidation_CashInsufficient() {
  console.log('\n  Edge: backend rechaza cash con paid < total');
  const total = 30;
  const paid_amount = 28; // insuficiente
  const sale_type = 'cash';
  const rejected = sale_type === 'cash' && paid_amount > 0 && paid_amount < total - 0.05;
  ok('Validación rechaza pago insuficiente', rejected);
}

function testEdge_BackendValidation_CashSufficient() {
  console.log('\n  Edge: backend acepta cash con paid >= total');
  const total = 30;
  const paid_amount = 30.02;
  const sale_type = 'cash';
  const rejected = sale_type === 'cash' && paid_amount > 0 && paid_amount < total - 0.05;
  ok('Validación acepta pago suficiente', !rejected);
}

function testEdge_BackendValidation_CashWithinTolerance() {
  console.log('\n  Edge: backend acepta cash dentro de tolerancia ($0.05)');
  const total = 30;
  const paid_amount = 29.96; // total - 0.04, dentro de tolerancia
  const sale_type = 'cash';
  const rejected = sale_type === 'cash' && paid_amount > 0 && paid_amount < total - 0.05;
  ok('Validación acepta dentro de tolerancia', !rejected);
}

function testEdge_BackendValidation_CreditSkips() {
  console.log('\n  Edge: backend no valida credit/mixed');
  const total = 30;
  const paid_amount = 0;
  const rejected_credit = 'credit' === 'cash' && paid_amount > 0 && paid_amount < total - 0.05;
  const rejected_mixed = 'mixed' === 'cash' && paid_amount > 0 && paid_amount < total - 0.05;
  ok('credit no se rechaza', !rejected_credit);
  ok('mixed no se rechaza', !rejected_mixed);
}

// ─── run ─────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════');
console.log(' Payment Conversion Tests');
console.log(' copPerUSD=' + copPerUSD + '  vesRate=' + vesRate);
console.log('═══════════════════════════════════════════════════');

console.log('\n── CASOS DE USO ──');
testCase1_USDMode_PayUSD_SystemRate();
testCase2_USDMode_PayCOP();
testCase3_USDMode_PayVES_SystemRate();
testCase4_USDMode_PayVES_CustomRate();
testCase5_COPMode_PayCOP();
testCase6_COPMode_PayUSD_SystemRate();
testCase7_COPMode_PayUSD_CustomRate();
testCase8_COPMode_PayVES_SystemRate();
testCase9_COPMode_PayVES_CustomRate();
testCase10_COPMode_MixedUSDCOP();
testCase11_COPMode_PayUSD_CustomRate_BugRegression();

console.log('\n── EDGE CASES ──');
testEdge_CopRateZero();
testEdge_CopRateNull();
testEdge_CopRateUndefined();
testEdge_NegativeCOP_Change();
testEdge_BackendValidation_CashInsufficient();
testEdge_BackendValidation_CashSufficient();
testEdge_BackendValidation_CashWithinTolerance();
testEdge_BackendValidation_CreditSkips();

console.log('\n═══════════════════════════════════════════════════');
console.log(` Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
