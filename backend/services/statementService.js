/**
 * statementService.js
 * Lógica compartida para generar el ledger/kardex de un cliente.
 * Usada por customer.controller (modal) y ar.controller (full-page).
 */
const { Op } = require('sequelize');
const { Sale, SalePayment, CreditNote, Customer } = require('../models');

/**
 * Calcula el effective due date de una venta:
 * - Si tiene credit_due_date: usarlo directamente
 * - Si no: sale_date + customer.credit_days (fallback para ventas legacy)
 * - Si credit_days = 0: null (sin término)
 */
function computeDueDate(sale, creditDays) {
  if (sale.credit_due_date) return new Date(sale.credit_due_date);
  if (!creditDays || creditDays === 0) return null;
  const d = new Date(sale.sale_date);
  d.setDate(d.getDate() + creditDays);
  return d;
}

/**
 * Calcula el aging bucket en función de los días vencida.
 * @param {Date|null} dueDate
 * @returns {{ bucket: string, daysOverdue: number }}
 */
function computeAgingBucket(dueDate) {
  if (!dueDate) return { bucket: 'sin_termino', daysOverdue: 0 };
  const now = new Date();
  const diffMs = now - dueDate;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return { bucket: 'vigente', daysOverdue: 0 };
  if (days <= 30) return { bucket: '0_30', daysOverdue: days };
  if (days <= 60) return { bucket: '31_60', daysOverdue: days };
  if (days <= 90) return { bucket: '61_90', daysOverdue: days };
  return { bucket: '+90', daysOverdue: days };
}

/**
 * Genera el ledger completo de un cliente (en USD + COP).
 * @param {number} customerId
 * @returns {{ customer, summary, ledger }}
 */
async function buildCustomerStatement(customerId) {
  const customer = await Customer.findOne({
    where: { id: customerId, isDeleted: false }
  });
  if (!customer) return null;

  // 1. Ventas a crédito + Pagos (con eager load)
  const sales = await Sale.findAll({
    where: {
      customer_id: customerId,
      status: { [Op.notIn]: ['cancelled'] },
      sale_type: 'credit'
    },
    attributes: ['id', 'sale_number', 'sale_date', 'total', 'paid_amount', 'exchange_rate', 'sale_type', 'status', 'credit_due_date', 'user_id'],
    include: [{
      model: SalePayment,
      as: 'payments',
      where: { reversed_at: null },
      required: false,
      attributes: ['id', 'payment_date', 'payment_method', 'amount', 'currency', 'exchange_rate', 'reference', 'created_at']
    }]
  });

  // 2. Extraer pagos de las ventas (ya están cargados)
  const payments = [];
  for (const sale of sales) {
    if (sale.payments && sale.payments.length) {
      for (const pay of sale.payments) {
        const payData = pay.toJSON ? pay.toJSON() : pay;
        payments.push({ ...payData, sale: { id: sale.id, sale_number: sale.sale_number, exchange_rate: sale.exchange_rate } });
      }
    }
  }

  // 3. Notas de crédito aprobadas / aplicadas
  let creditNotes = [];
  try {
    creditNotes = await CreditNote.findAll({
      where: {
        customer_id: customerId,
        status: { [Op.in]: ['approved', 'applied'] }
      },
      attributes: ['id', 'credit_note_number', 'credit_note_date', 'total', 'refund_method', 'type', 'exchange_rate', 'sale_id'],
      include: [{ model: Sale, as: 'sale', attributes: ['exchange_rate'], required: false }]
    });
  } catch (_) { /* CreditNote puede no estar migrada */ }

  // CN por sale_id (para mostrar en cargo)
  const cnBySaleId = {};
  for (const note of creditNotes) {
    const sid = note.sale_id;
    if (!sid) continue;
    const usd = parseFloat(note.total || 0);
    const rate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
    if (!cnBySaleId[sid]) cnBySaleId[sid] = { usd: 0, cop: 0, notes: [] };
    cnBySaleId[sid].usd += usd;
    cnBySaleId[sid].cop += Math.round(usd * rate);
    cnBySaleId[sid].notes.push({
      id: note.id, number: note.credit_note_number,
      date: note.credit_note_date,
      total_usd: usd, total_cop: Math.round(usd * rate),
      refund_method: note.refund_method
    });
  }

  const ledger = [];
  const summary = {};
  const creditDays = customer.creditDays || 0;

  // Procesar cargos (ventas)
  for (const sale of sales) {
    const amtUSD = parseFloat(sale.total || 0);
    const rate = parseFloat(sale.exchange_rate || 1);
    const amtCOP = amtUSD * rate;
    const cnData = cnBySaleId[sale.id] || { usd: 0, cop: 0, notes: [] };

    if (!summary['USD']) summary['USD'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
    if (!summary['COP']) summary['COP'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
    summary['USD'].total_invoiced += amtUSD;
    summary['COP'].total_invoiced += amtCOP;

    const dueDate = computeDueDate(sale, creditDays);
    const { bucket, daysOverdue } = computeAgingBucket(dueDate);

    const enriched = {
      ...sale.toJSON(),
      cn_amount_usd: cnData.usd,
      cn_amount_cop: cnData.cop,
      applied_credit_notes: cnData.notes,
      due_date: dueDate,
      aging_bucket: bucket,
      days_overdue: daysOverdue
    };

    ledger.push({
      id: `sale_${sale.id}_usd`, type: 'charge', date: new Date(sale.sale_date),
      reference: sale.sale_number, amount: amtUSD, currency: 'USD',
      description: 'Venta (Crédito)', original_amount: amtUSD, original_currency: 'USD',
      original_data: enriched
    });
    ledger.push({
      id: `sale_${sale.id}_cop`, type: 'charge', date: new Date(sale.sale_date),
      reference: sale.sale_number, amount: amtCOP, currency: 'COP',
      description: 'Venta (Crédito)', original_amount: amtUSD, original_currency: 'USD',
      original_data: enriched
    });
  }

  // Procesar pagos
  for (const pay of payments) {
    const payCurrency = pay.currency || 'USD';
    const amtOrig = parseFloat(pay.amount || 0);
    const rate = parseFloat(
      (pay.exchange_rate && parseFloat(pay.exchange_rate) !== 1)
        ? pay.exchange_rate : (pay.sale?.exchange_rate || 1)
    );
    let amtUSD, amtCOP;
    if (payCurrency === 'COP') { amtCOP = amtOrig; amtUSD = amtOrig / rate; }
    else { amtUSD = amtOrig; amtCOP = amtOrig * rate; }

    if (!summary['USD']) summary['USD'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
    if (!summary['COP']) summary['COP'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
    summary['USD'].total_paid += amtUSD;
    summary['COP'].total_paid += amtCOP;

    const isInternal = pay.payment_method === 'credit_balance';
    const type = isInternal ? 'internal_transfer' : 'payment';

    ledger.push({
      id: `pay_${pay.id}_usd`, type, date: new Date(pay.payment_date),
      reference: `PAGO-${pay.id}`, amount: amtUSD, currency: 'USD',
      description: `Abono a Venta ${pay.sale?.sale_number} (${pay.payment_method})`,
      isInternal, original_amount: amtOrig, original_currency: payCurrency,
      original_data: { ...pay, sale: pay.sale },
      created_at: pay.created_at
    });
    ledger.push({
      id: `pay_${pay.id}_cop`, type, date: new Date(pay.payment_date),
      reference: `PAGO-${pay.id}`, amount: amtCOP, currency: 'COP',
      description: `Abono a Venta ${pay.sale?.sale_number} (${pay.payment_method})`,
      isInternal, original_amount: amtOrig, original_currency: payCurrency,
      original_data: { ...pay, sale: pay.sale },
      created_at: pay.created_at
    });
  }

  // Procesar notas de crédito
  for (const note of creditNotes) {
    const amtUSD = parseFloat(note.total || 0);
    const rate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
    const amtCOP = Math.round(amtUSD * rate);
    ledger.push({
      id: `cn_${note.id}_usd`, type: 'credit', date: new Date(note.credit_note_date),
      reference: note.credit_note_number, amount: amtUSD, currency: 'USD',
      description: `Nota de Crédito (${note.refund_method})`,
      isInternal: false, original_data: note.toJSON ? note.toJSON() : note
    });
    ledger.push({
      id: `cn_${note.id}_cop`, type: 'credit', date: new Date(note.credit_note_date),
      reference: note.credit_note_number, amount: amtCOP, currency: 'COP',
      description: `Nota de Crédito (${note.refund_method})`,
      isInternal: false, original_data: note.toJSON ? note.toJSON() : note
    });
  }

  // Calcular balance real (per-venta)
  let truePendingUSD = 0, truePendingCOP = 0;
  for (const sale of sales) {
    const total = parseFloat(sale.total || 0);
    const paid = parseFloat(sale.paid_amount || 0);
    const cn = cnBySaleId[sale.id]?.usd || 0;
    const rate = parseFloat(sale.exchange_rate || 1);
    const pending = Math.max(0, total - paid - cn);
    truePendingUSD += pending;
    truePendingCOP += pending * rate;
  }
  if (summary['USD']) summary['USD'].balance = truePendingUSD;
  if (summary['COP']) summary['COP'].balance = Math.round(truePendingCOP);

  // Calcular saldo a favor (COP)
  const realPaymentsBySale = {};
  for (const pay of payments) {
    if (pay.payment_method === 'credit_balance') continue;
    const sid = pay.sale?.id;
    if (!sid) continue;
    if (!realPaymentsBySale[sid]) realPaymentsBySale[sid] = [];
    realPaymentsBySale[sid].push(pay);
  }
  let totalRealPaidCOP = 0, totalInvoicedForRealCOP = 0;
  for (const sale of sales) {
    const saleRate = parseFloat(sale.exchange_rate || 1);
    const realPays = realPaymentsBySale[sale.id] || [];
    if (!realPays.length) continue;
    const paidCOP = realPays.reduce((s, p) => {
      if (p.currency === 'COP') return s + parseFloat(p.amount);
      const r = parseFloat(p.exchange_rate && parseFloat(p.exchange_rate) !== 1 ? p.exchange_rate : saleRate);
      return s + parseFloat(p.amount) * r;
    }, 0);
    totalInvoicedForRealCOP += parseFloat(sale.total) * saleRate;
    totalRealPaidCOP += paidCOP;
  }
  const overpaymentCOP = Math.max(0, totalRealPaidCOP - totalInvoicedForRealCOP);

  // Calcular credit_balance usado (está en los payments que ya cargamos)
  let creditBalanceUsedCOP = 0;
  for (const p of payments) {
    if (p.payment_method !== 'credit_balance') continue;
    const r = parseFloat((p.exchange_rate && parseFloat(p.exchange_rate) !== 1 ? p.exchange_rate : p.sale?.exchange_rate) || 1);
    creditBalanceUsedCOP += p.currency === 'COP' ? parseFloat(p.amount) : parseFloat(p.amount) * r;
  }
  let cnCreditBalanceCOP = 0;
  for (const note of creditNotes) {
    if (note.refund_method === 'credit_balance') {
      const r = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
      cnCreditBalanceCOP += Math.round(parseFloat(note.total || 0) * r);
    }
  }
  const availableCreditCOP = Math.max(0, overpaymentCOP + cnCreditBalanceCOP - creditBalanceUsedCOP);
  if (summary['COP']) summary['COP'].available_credit = Math.round(availableCreditCOP);

  // Ordenar cronológicamente
  ledger.sort((a, b) => a.date - b.date);

  return {
    customer: {
      id: customer.id,
      code: customer.code,
      name: customer.getFullName ? customer.getFullName() : `${customer.firstName} ${customer.lastName}`,
      documentNumber: customer.documentNumber,
      creditDays: customer.creditDays || 0
    },
    summary,
    ledger
  };
}

/**
 * Determina si un cliente está bloqueado para crédito (tiene factura vencida sin pagar).
 * @param {number} customerId
 * @returns {{ blocked: boolean, reason: string|null }}
 */
async function getCustomerCreditBlock(customerId) {
  const customer = await Customer.findOne({ where: { id: customerId, isDeleted: false } });
  if (!customer) return { blocked: false, reason: null };

  const creditDays = customer.creditDays || 0;
  const allSales = await Sale.findAll({
    where: {
      customer_id: customerId,
      sale_type: 'credit',
      status: { [Op.notIn]: ['cancelled', 'returned'] }
    },
    attributes: ['id', 'sale_number', 'sale_date', 'total', 'paid_amount', 'credit_due_date']
  });

  // Filtrar solo ventas con saldo pendiente
  const pendingSales = allSales.filter(s =>
    parseFloat(s.paid_amount || 0) < parseFloat(s.total || 0) - 0.001
  );

  const now = new Date();
  for (const sale of pendingSales) {
    const dueDate = computeDueDate(sale, creditDays);
    if (dueDate && dueDate < now) {
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      return {
        blocked: true,
        reason: `${sale.sale_number} vencida hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''}`,
        sale_number: sale.sale_number,
        due_date: dueDate,
        days_overdue: daysOverdue
      };
    }
  }
  return { blocked: false, reason: null };
}

module.exports = { buildCustomerStatement, getCustomerCreditBlock, computeDueDate, computeAgingBucket };
