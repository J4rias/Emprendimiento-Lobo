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

// ─── getCustomerCreditBalance ─────────────────────────────────────────────────
// El estado de cuenta (ledger) vive en statementService.buildCustomerStatement,
// compartido por customer.controller y ar.controller.

export async function getCustomerCreditBalance(customerId: string | number) {
  const sales = await Sale.findAll({
    where: { customer_id: customerId, sale_type: 'credit', status: { [Op.notIn]: ['cancelled'] } },
    attributes: ['id', 'total', 'exchange_rate'],
    include: [{ model: SalePayment, as: 'payments', attributes: ['amount', 'currency', 'exchange_rate', 'payment_method'] }]
  }) as any[];

  let totalInvoicedCOP = 0;
  let totalPaidCOP = 0;
  let creditBalanceUsedCOP = 0;

  for (const s of sales) {
    const saleRate = parseFloat(s.exchange_rate || 1);
    const allPayments = s.payments || [];
    const realPayments = allPayments.filter((p: any) => p.payment_method !== 'credit_balance');
    const creditPayments = allPayments.filter((p: any) => p.payment_method === 'credit_balance');

    if (allPayments.length > 0) {
      totalInvoicedCOP += parseFloat(s.total) * saleRate;
      totalPaidCOP += realPayments.reduce((sum: number, p: any) => {
        if (p.currency === 'COP') return sum + parseFloat(p.amount);
        return sum + parseFloat(p.amount) * parseFloat(p.exchange_rate || saleRate);
      }, 0);
    }

    creditBalanceUsedCOP += creditPayments.reduce((sum: number, p: any) => {
      if (p.currency === 'COP') return sum + parseFloat(p.amount);
      return sum + parseFloat(p.amount) * parseFloat(p.exchange_rate || saleRate);
    }, 0);
  }

  const overpaymentCOP = Math.max(0, totalPaidCOP - totalInvoicedCOP);

  // Credit from credit notes with refund_method='credit_balance'
  const creditNotes = await CreditNote.findAll({
    where: {
      customer_id: customerId,
      status: 'applied',
      refund_method: 'credit_balance'
    },
    attributes: ['total', 'exchange_rate']
  }) as any[];

  let cnCreditCOP = 0;
  for (const cn of creditNotes) {
    cnCreditCOP += parseFloat(cn.total || 0) * parseFloat(cn.exchange_rate || 1);
  }

  const availableCreditCOP = Math.max(0, overpaymentCOP + cnCreditCOP - creditBalanceUsedCOP);
  return { credit_balance_cop: Math.round(availableCreditCOP), credit_balance_usd: 0 };
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
      AND c.deleted_at IS NULL
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
