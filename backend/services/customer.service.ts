import { Op } from 'sequelize';
import Customer from '../models/Customer';
import Sale from '../models/Sale';
import SaleDetail from '../models/SaleDetail';
import SalePayment from '../models/SalePayment';
import CreditNote from '../models/CreditNote';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';

const { sequelize } = require('../config/database');

// ─── getCustomerStats ─────────────────────────────────────────────────────────

export async function getCustomerStats(customerId: string | number) {
  const customer = await Customer.findOne({ where: { id: customerId } }) as any;
  if (!customer) return null;

  const salesStats = await Sale.findAll({
    where: { customer_id: customerId },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalSales'],
      [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount'],
      [sequelize.fn('AVG', sequelize.col('total')), 'averageAmount']
    ],
    raw: true
  }) as any[];

  const recentSales = await Sale.findAll({
    where: { customer_id: customerId },
    attributes: ['id', 'sale_number', 'sale_date', 'total', 'paid_amount'],
    order: [['sale_date', 'DESC']],
    limit: 5
  }) as any[];

  // payment_status is not a real DB column — compute via CASE expression
  const paymentSummaryRaw = await sequelize.query(`
    SELECT
      CASE
        WHEN paid_amount <= 0 THEN 'pending'
        WHEN paid_amount >= total THEN 'paid'
        ELSE 'partial'
      END AS payment_status,
      COUNT(*) AS count,
      SUM(total) AS amount
    FROM sales
    WHERE customer_id = :customerId
      AND deleted_at IS NULL
    GROUP BY 1
  `, { replacements: { customerId }, type: sequelize.QueryTypes.SELECT }) as any[];

  const stats = salesStats[0];
  return {
    customer: { id: customer.id, code: customer.code, name: customer.getFullName() },
    sales: {
      total: parseInt(stats.totalSales) || 0,
      totalAmount: parseFloat(stats.totalAmount) || 0,
      averageAmount: parseFloat(stats.averageAmount) || 0
    },
    paymentSummary: paymentSummaryRaw.map((p: any) => ({
      status: p.payment_status,
      count: parseInt(p.count),
      amount: parseFloat(p.amount)
    })),
    recentSales: recentSales.map((s: any) => {
      const json = s.toJSON ? s.toJSON() : s;
      const paid = parseFloat(json.paid_amount || 0);
      const total = parseFloat(json.total || 0);
      return {
        ...json,
        total,
        payment_status: paid <= 0 ? 'pending' : paid >= total ? 'paid' : 'partial'
      };
    })
  };
}

// ─── getOverdueCustomers ──────────────────────────────────────────────────────

export async function getOverdueCustomers() {
  const today = new Date();

  const overdueSales = await Sale.findAll({
    where: {
      sale_type: 'credit',
      status: { [Op.notIn]: ['cancelled', 'returned'] }
    } as any,
    attributes: ['id', 'sale_number', 'sale_date', 'total', 'paid_amount', 'customer_id'],
    include: [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'code', 'first_name', 'last_name', 'business_name', 'type', 'phone', 'mobile', 'credit_days', 'credit_limit', 'credit_used'],
      },
      { model: SalePayment, as: 'payments', attributes: ['amount'], required: false }
    ]
  }) as any[];

  return overdueSales
    .map((sale: any) => {
      const customer = sale.customer;
      const creditDays = customer?.credit_days || 0;
      const dueDate = new Date(sale.sale_date);
      dueDate.setDate(dueDate.getDate() + creditDays);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const paid = (sale.payments || []).reduce((sum: any, p: any) => sum + parseFloat(p.amount), 0);
      const balance = parseFloat(sale.total) - paid;
      return { sale, customer, dueDate, daysOverdue, balance };
    })
    .filter((item: any) => item.daysOverdue > 0 && item.balance > 0)
    .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue)
    .map((item: any) => ({
      customer: {
        id: item.customer.id,
        code: item.customer.code,
        name: item.customer.getFullName
          ? item.customer.getFullName()
          : (item.customer.business_name || `${item.customer.first_name} ${item.customer.last_name}`),
        phone: item.customer.phone || item.customer.mobile
      },
      sale: {
        id: item.sale.id,
        sale_number: item.sale.sale_number,
        sale_date: item.sale.sale_date,
        total: parseFloat(item.sale.total),
        balance: item.balance,
        due_date: item.dueDate,
        days_overdue: item.daysOverdue
      },
      aging_bucket: item.daysOverdue <= 30 ? '0-30'
        : item.daysOverdue <= 60 ? '31-60'
        : item.daysOverdue <= 90 ? '61-90' : '+90'
    }));
}

// ─── getCustomerStatement ─────────────────────────────────────────────────────

export async function getCustomerStatement(customerId: string | number) {
  const customer = await Customer.findOne({ where: { id: customerId } }) as any;
  if (!customer) return null;

  const sales = await Sale.findAll({
    where: {
      customer_id: customerId,
      status: { [Op.notIn]: ['cancelled'] },
      sale_type: 'credit'
    },
    attributes: ['id', 'sale_number', 'sale_date', 'total', 'paid_amount', 'exchange_rate', 'sale_type', 'status']
  }) as any[];

  const payments = await SalePayment.findAll({
    include: [{
      model: Sale,
      as: 'sale',
      where: { customer_id: customerId, sale_type: 'credit' },
      attributes: ['id', 'sale_number', 'exchange_rate']
    }],
    attributes: ['id', 'payment_date', 'payment_method', 'amount', 'currency', 'exchange_rate', 'reference']
  }) as any[];

  let creditNotes: any[] = [];
  try {
    if (CreditNote) {
      creditNotes = await CreditNote.findAll({
        where: {
          customer_id: customerId,
          status: { [Op.in]: ['approved', 'applied'] }
        },
        attributes: ['id', 'credit_note_number', 'credit_note_date', 'total', 'refund_method', 'type', 'exchange_rate', 'sale_id'],
        include: [{ model: Sale, as: 'sale', attributes: ['exchange_rate'], required: false }]
      }) as any[];
    }
  } catch (e) { /* ignore if CreditNote not available */ }

  // Build credit-note totals per sale_id
  const cnBySaleId: any = {};
  for (const note of creditNotes) {
    const saleId = note.sale_id;
    if (!saleId) continue;
    const noteUSD = parseFloat(note.total || 0);
    const noteRate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
    if (!cnBySaleId[saleId]) cnBySaleId[saleId] = { usd: 0, cop: 0, notes: [] };
    cnBySaleId[saleId].usd += noteUSD;
    cnBySaleId[saleId].cop += Math.round(noteUSD * noteRate);
    cnBySaleId[saleId].notes.push({
      id: note.id, number: note.credit_note_number, date: note.credit_note_date,
      total_usd: noteUSD, total_cop: Math.round(noteUSD * noteRate),
      refund_method: note.refund_method
    });
  }

  const ledger: any[] = [];
  const summary: any = {};

  // Process Sales (Charges)
  for (const sale of sales) {
    const amountOrig = parseFloat(sale.total || 0);
    const rate = parseFloat(sale.exchange_rate || 1);
    const amtUSD = amountOrig;
    const amtCOP = amountOrig * rate;
    const cnData = cnBySaleId[sale.id] || { usd: 0, cop: 0, notes: [] };
    const saleJson = sale.toJSON ? sale.toJSON() : sale;
    const enrichedSale = { ...saleJson, cn_amount_usd: cnData.usd, cn_amount_cop: cnData.cop, applied_credit_notes: cnData.notes };

    if (!summary['USD']) summary['USD'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: parseFloat(customer.creditBalance || 0) };
    if (sale.sale_type === 'credit') summary['USD'].total_invoiced += amtUSD;
    ledger.push({
      id: `sale_${sale.id}_usd`, type: 'charge', date: new Date(sale.sale_date),
      reference: sale.sale_number, amount: amtUSD, currency: 'USD',
      description: `Venta ${sale.sale_type === 'cash' ? '(Contado)' : '(Crédito)'}`,
      original_amount: amountOrig, original_currency: 'USD', original_data: enrichedSale
    });

    if (!summary['COP']) summary['COP'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
    if (sale.sale_type === 'credit') summary['COP'].total_invoiced += amtCOP;
    ledger.push({
      id: `sale_${sale.id}_cop`, type: 'charge', date: new Date(sale.sale_date),
      reference: sale.sale_number, amount: amtCOP, currency: 'COP',
      description: `Venta ${sale.sale_type === 'cash' ? '(Contado)' : '(Crédito)'}`,
      original_amount: amountOrig, original_currency: 'USD', original_data: enrichedSale
    });
  }

  // Process Payments (Credits)
  for (const pay of payments) {
    const payCurrency = pay.currency || 'USD';
    const amountOrig = parseFloat(pay.amount || 0);
    const rate = parseFloat(
      (pay.exchange_rate && parseFloat(pay.exchange_rate) !== 1) ? pay.exchange_rate : (pay.sale?.exchange_rate || 1)
    );

    let amtUSD: number, amtCOP: number;
    if (payCurrency === 'USD') {
      amtUSD = amountOrig; amtCOP = amountOrig * rate;
    } else if (payCurrency === 'COP') {
      amtCOP = amountOrig; amtUSD = amountOrig / rate;
    } else {
      amtUSD = amountOrig; amtCOP = amountOrig * rate;
    }

    if (!summary['USD']) summary['USD'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
    summary['USD'].total_paid += amtUSD;
    ledger.push({
      id: `pay_${pay.id}_usd`,
      type: pay.payment_method === 'credit_balance' ? 'internal_transfer' : 'payment',
      date: new Date(pay.payment_date), reference: `PAGO-${pay.id}`, amount: amtUSD, currency: 'USD',
      description: `Abono a Venta ${pay.sale?.sale_number} (${pay.payment_method})`,
      isInternal: pay.payment_method === 'credit_balance',
      original_amount: amountOrig, original_currency: payCurrency, original_data: pay
    });

    if (!summary['COP']) summary['COP'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: parseFloat(customer.creditBalance || 0) * rate };
    summary['COP'].total_paid += amtCOP;
    ledger.push({
      id: `pay_${pay.id}_cop`,
      type: pay.payment_method === 'credit_balance' ? 'internal_transfer' : 'payment',
      date: new Date(pay.payment_date), reference: `PAGO-${pay.id}`, amount: amtCOP, currency: 'COP',
      description: `Abono a Venta ${pay.sale?.sale_number} (${pay.payment_method})`,
      isInternal: pay.payment_method === 'credit_balance',
      original_amount: amountOrig, original_currency: payCurrency, original_data: pay
    });
  }

  // Process Credit Notes (Credits)
  for (const note of creditNotes) {
    const amountUSD = parseFloat(note.total || 0);
    const rate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
    const amountCOP = Math.round(amountUSD * rate);

    ledger.push({
      id: `cn_${note.id}_usd`, type: 'credit', date: new Date(note.credit_note_date),
      reference: note.credit_note_number, amount: amountUSD, currency: 'USD',
      description: `Nota de Crédito (${note.refund_method})`, isInternal: false, original_data: note
    });
    ledger.push({
      id: `cn_${note.id}_cop`, type: 'credit', date: new Date(note.credit_note_date),
      reference: note.credit_note_number, amount: amountCOP, currency: 'COP',
      description: `Nota de Crédito (${note.refund_method})`, isInternal: false, original_data: note
    });
  }

  // True pending balance per-sale
  let truePendingUSD = 0;
  let truePendingCOP = 0;
  for (const sale of sales) {
    const totalUSD = parseFloat(sale.total || 0);
    const paidUSD = parseFloat(sale.paid_amount || 0);
    const cnUSD = cnBySaleId[sale.id]?.usd || 0;
    const rate = parseFloat(sale.exchange_rate || 1);
    const pendingUSD = Math.max(0, totalUSD - paidUSD - cnUSD);
    truePendingUSD += pendingUSD;
    truePendingCOP += pendingUSD * rate;
  }
  if (summary['USD']) summary['USD'].balance = truePendingUSD;
  if (summary['COP']) summary['COP'].balance = Math.round(truePendingCOP);

  // Saldo a favor (3-step calculation)
  const realPaymentsBySale: any = {};
  for (const pay of payments) {
    if (pay.payment_method === 'credit_balance') continue;
    const saleId = pay.sale?.id;
    if (!saleId) continue;
    if (!realPaymentsBySale[saleId]) realPaymentsBySale[saleId] = [];
    realPaymentsBySale[saleId].push(pay);
  }
  let totalRealPaidCOP = 0;
  let totalInvoicedForReallyPaidCOP = 0;
  for (const sale of sales) {
    const saleRate = parseFloat(sale.exchange_rate || 1);
    const saleRealPays = realPaymentsBySale[sale.id] || [];
    if (saleRealPays.length === 0) continue;
    const paidCOP = saleRealPays.reduce((sum: any, p: any) => {
      if (p.currency === 'COP') return sum + parseFloat(p.amount);
      const payRate = parseFloat(p.exchange_rate && parseFloat(p.exchange_rate) !== 1 ? p.exchange_rate : saleRate);
      return sum + parseFloat(p.amount) * payRate;
    }, 0);
    totalInvoicedForReallyPaidCOP += parseFloat(sale.total) * saleRate;
    totalRealPaidCOP += paidCOP;
  }
  const overpaymentCOP = Math.max(0, totalRealPaidCOP - totalInvoicedForReallyPaidCOP);

  const allCBPayments = await SalePayment.findAll({
    include: [{
      model: Sale, as: 'sale',
      where: { customer_id: customerId },
      attributes: ['id', 'exchange_rate']
    }],
    where: { payment_method: 'credit_balance' },
    attributes: ['amount', 'currency', 'exchange_rate']
  }) as any[];
  let creditBalanceUsedCOP = 0;
  for (const p of allCBPayments) {
    const rate = parseFloat((p.exchange_rate && parseFloat(p.exchange_rate) !== 1 ? p.exchange_rate : p.sale?.exchange_rate) || 1);
    creditBalanceUsedCOP += p.currency === 'COP' ? parseFloat(p.amount) : parseFloat(p.amount) * rate;
  }

  let creditNotesCreditBalanceCOP = 0;
  for (const note of creditNotes) {
    if (note.refund_method === 'credit_balance') {
      const noteUSD = parseFloat(note.total || 0);
      const noteRate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
      creditNotesCreditBalanceCOP += Math.round(noteUSD * noteRate);
    }
  }

  const availableCreditCOP = Math.max(0, overpaymentCOP + creditNotesCreditBalanceCOP - creditBalanceUsedCOP);
  if (summary['COP']) summary['COP'].available_credit = Math.round(availableCreditCOP);
  if (summary['USD']) summary['USD'].available_credit = 0;

  ledger.sort((a, b) => a.date - b.date);

  return {
    customer: {
      id: customer.id,
      name: customer.getFullName ? customer.getFullName() : `${customer.first_name} ${customer.last_name}`,
      documentNumber: customer.document_number,
      credit_limit: parseFloat(customer.credit_limit || 0),
      credit_used: parseFloat(customer.credit_used || 0)
    },
    summary,
    ledger
  };
}

// ─── getCustomerCreditBalance ─────────────────────────────────────────────────

export async function getCustomerCreditBalance(customerId: string | number) {
  const sales = await Sale.findAll({
    where: { customer_id: customerId, sale_type: 'credit', status: { [Op.notIn]: ['cancelled'] } },
    attributes: ['id', 'total', 'exchange_rate'],
    include: [{ model: SalePayment, as: 'payments', attributes: ['amount', 'currency', 'exchange_rate', 'payment_method'] }]
  }) as any[];

  let totalInvoicedCOP = 0;
  let totalPaidCOP = 0;
  for (const s of sales) {
    const saleRate = parseFloat(s.exchange_rate || 1);
    const realPayments = (s.payments || []).filter((p: any) => p.payment_method !== 'credit_balance');
    const hasPaid = (s.payments || []).length > 0;
    const paidCOP = realPayments.reduce((pSum: any, p: any) => {
      if (p.currency === 'COP') return pSum + parseFloat(p.amount);
      return pSum + parseFloat(p.amount) * parseFloat(p.exchange_rate || saleRate);
    }, 0);
    if (hasPaid) {
      totalInvoicedCOP += parseFloat(s.total) * saleRate;
      totalPaidCOP += paidCOP;
    }
  }
  const creditBalanceCOP = Math.max(0, totalPaidCOP - totalInvoicedCOP);
  return { credit_balance_cop: Math.round(creditBalanceCOP), credit_balance_usd: 0 };
}

// ─── getCustomerPurchases ─────────────────────────────────────────────────────

export async function getCustomerPurchases(customerId: string | number, dateFrom: Date, dateTo: Date) {
  const sales = await Sale.findAll({
    where: {
      customer_id: customerId,
      status: { [Op.ne]: 'cancelled' },
      sale_date: { [Op.between]: [dateFrom, dateTo] }
    },
    include: [{
      model: SaleDetail, as: 'details',
      attributes: ['product_id', 'quantity', 'unit_price', 'total', 'is_unit'],
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name'] },
        { model: ProductPresentation, as: 'presentation', attributes: ['id', 'units_per_package'] }
      ]
    }],
    order: [['sale_date', 'DESC']]
  }) as any[];

  return sales.map((sale: any) => ({
    sale_id: sale.id,
    date: sale.sale_date,
    total_usd: parseFloat(sale.total),
    total_cop: sale.currency_mode === 'COP'
      ? Math.round(parseFloat(sale.total))
      : Math.round(parseFloat(sale.total) * parseFloat(sale.exchange_rate)),
    payment_type: sale.sale_type,
    items: (sale.details || []).map((d: any) => {
      const qty = parseFloat(d.quantity);
      const upp = d.presentation ? parseInt(d.presentation.units_per_package) || 1 : 1;
      const normalizedQty = d.is_unit ? qty : qty * upp;
      return {
        product_id: d.product_id,
        product_name: d.product ? d.product.name : null,
        quantity: normalizedQty,
        units_per_package: upp,
        unit_price: parseFloat(d.unit_price),
        total: parseFloat(d.total)
      };
    })
  }));
}

// ─── getCustomerActivity ──────────────────────────────────────────────────────

export async function getCustomerActivity(daysInt: number, minPurchases: number) {
  const dateFrom = new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000);

  const results = await sequelize.query(`
    SELECT
      c.id AS customer_id,
      COALESCE(c.business_name, CONCAT(c.first_name, ' ', c.last_name)) AS customer_name,
      COALESCE(c.phone, c.mobile) AS customer_phone,
      COUNT(s.id) AS total_purchases,
      ROUND(SUM(s.total), 2) AS total_spent_usd,
      MIN(DATE(s.sale_date)) AS first_purchase,
      MAX(DATE(s.sale_date)) AS last_purchase,
      CASE
        WHEN COUNT(s.id) > 1
        THEN ROUND(DATEDIFF(MAX(s.sale_date), MIN(s.sale_date)) / (COUNT(s.id) - 1), 1)
        ELSE NULL
      END AS avg_days_between_purchases
    FROM customers c
    INNER JOIN sales s ON s.customer_id = c.id
    WHERE s.status != 'cancelled'
      AND s.deleted_at IS NULL
      AND s.sale_date >= :dateFrom
      AND c.is_deleted = 0
    GROUP BY c.id
    HAVING total_purchases >= :minPurchases
    ORDER BY total_purchases DESC
  `, { replacements: { dateFrom, minPurchases }, type: sequelize.QueryTypes.SELECT });

  return (results as any[]).map((r: any) => ({
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    total_purchases: parseInt(r.total_purchases),
    total_spent_usd: parseFloat(r.total_spent_usd),
    first_purchase: r.first_purchase,
    last_purchase: r.last_purchase,
    avg_days_between_purchases: r.avg_days_between_purchases ? parseFloat(r.avg_days_between_purchases) : null
  }));
}
