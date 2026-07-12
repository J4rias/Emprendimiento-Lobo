import { Op } from 'sequelize';
import Supplier from '../models/Supplier';
import PurchaseOrder from '../models/PurchaseOrder';
import SupplierPayment from '../models/SupplierPayment';
import SupplierPaymentAllocation from '../models/SupplierPaymentAllocation';
import ExchangeRate from '../models/ExchangeRate';

// ─── Category helpers ─────────────────────────────────────────────────────────

export function getLedgerCategory(currency: string, settlementCurrency: string): string {
  if (currency === 'COP') return 'COP';
  if (currency === 'USD' && settlementCurrency === 'USD') return 'DIVISAS';
  // USD paid in VES (default), or VES paid in VES
  return 'USD';
}

export function inferCategoryFromPaymentCurrency(paymentCurrency: string): string {
  if (paymentCurrency === 'VES') return 'USD';
  if (paymentCurrency === 'USD') return 'DIVISAS';
  if (paymentCurrency === 'COP') return 'COP';
  return 'USD';
}

// ─── getLedger (new endpoint with categories) ─────────────────────────────────

export async function getSupplierLedger(supplierId: string | number) {
  const supplier = await Supplier.findByPk(supplierId) as any;
  if (!supplier) return null;

  const purchaseOrders = await PurchaseOrder.findAll({
    where: { supplier_id: supplierId, status: { [Op.notIn]: ['cancelled'] } },
    attributes: ['id', 'order_number', 'order_date', 'total', 'currency', 'settlement_currency', 'status', 'notes'],
    order: [['order_date', 'ASC']]
  }) as any[];

  const payments = await SupplierPayment.findAll({
    where: { supplier_id: supplierId, status: { [Op.notIn]: ['cancelled'] } },
    attributes: ['id', 'payment_number', 'payment_date', 'payment_method', 'amount', 'currency', 'reference', 'exchange_rate', 'exchange_rate_from', 'exchange_rate_to', 'notes'],
    include: [{
      model: SupplierPaymentAllocation,
      as: 'allocations',
      attributes: ['id', 'purchase_order_id', 'allocated_amount', 'allocated_amount_po_currency', 'exchange_rate_used']
    }],
    order: [['payment_date', 'ASC']]
  }) as any[];

  const poMap: any = {};
  const categories: any = {};

  for (const po of purchaseOrders) {
    const cat = getLedgerCategory(po.currency, po.settlement_currency);
    poMap[po.id] = cat;

    if (!categories[cat]) {
      categories[cat] = { total_invoiced: 0, total_paid: 0, balance: 0, invoices: [], payments: [] };
    }

    const poTotal = parseFloat(po.total || 0);
    categories[cat].total_invoiced += poTotal;
    categories[cat].invoices.push({
      id: po.id, date: po.order_date, description: po.order_number,
      amount: poTotal, status: po.status, notes: po.notes
    });
  }

  for (const payment of payments) {
    const paymentAmount = parseFloat(payment.amount || 0);
    const paymentCurrency = payment.currency || 'USD';

    if (payment.allocations && payment.allocations.length > 0) {
      const allocByCategory: any = {};
      for (const alloc of payment.allocations) {
        const cat = poMap[alloc.purchase_order_id];
        if (!cat) continue;
        if (!allocByCategory[cat]) allocByCategory[cat] = { amountPoCurrency: 0, amountPayCurrency: 0 };
        allocByCategory[cat].amountPoCurrency += parseFloat(alloc.allocated_amount_po_currency || 0);
        allocByCategory[cat].amountPayCurrency += parseFloat(alloc.allocated_amount || 0);
      }

      for (const [cat, alloc] of Object.entries(allocByCategory) as [string, any][]) {
        if (!categories[cat]) {
          categories[cat] = { total_invoiced: 0, total_paid: 0, balance: 0, invoices: [], payments: [] };
        }
        categories[cat].total_paid += alloc.amountPoCurrency;
        categories[cat].payments.push({
          id: payment.id, date: payment.payment_date,
          description: payment.reference || payment.payment_number,
          payment_number: payment.payment_number, payment_method: payment.payment_method,
          bcv_rate: (paymentCurrency === 'VES' && payment.exchange_rate) ? parseFloat(payment.exchange_rate) : null,
          amount_ves: paymentCurrency === 'VES' ? paymentAmount : null,
          amount: alloc.amountPoCurrency
        });
      }
    } else {
      const cat = inferCategoryFromPaymentCurrency(paymentCurrency);
      if (!categories[cat]) {
        categories[cat] = { total_invoiced: 0, total_paid: 0, balance: 0, invoices: [], payments: [] };
      }

      let amountInCategoryCurrency = paymentAmount;
      if (paymentCurrency === 'VES' && payment.exchange_rate) {
        amountInCategoryCurrency = paymentAmount / parseFloat(payment.exchange_rate);
      }

      categories[cat].total_paid += amountInCategoryCurrency;
      categories[cat].payments.push({
        id: payment.id, date: payment.payment_date,
        description: payment.reference || payment.payment_number,
        payment_number: payment.payment_number, payment_method: payment.payment_method,
        bcv_rate: (paymentCurrency === 'VES' && payment.exchange_rate) ? parseFloat(payment.exchange_rate) : null,
        amount_ves: paymentCurrency === 'VES' ? paymentAmount : null,
        amount: amountInCategoryCurrency
      });
    }
  }

  for (const cat in categories) {
    categories[cat].balance = Math.round((categories[cat].total_invoiced - categories[cat].total_paid) * 100) / 100;
    categories[cat].total_invoiced = Math.round(categories[cat].total_invoiced * 100) / 100;
    categories[cat].total_paid = Math.round(categories[cat].total_paid * 100) / 100;
    categories[cat].invoices.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    categories[cat].payments.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  let bcvRate = null;
  try { bcvRate = await (ExchangeRate as any).getRate('USD', 'VES'); } catch (e) { /* rate not available */ }

  return {
    supplier: { id: supplier.id, name: supplier.name },
    bcv_rate: bcvRate,
    categories
  };
}

// ─── getResumen (cross-supplier balance summary) ──────────────────────────────

export async function getSupplierResumen() {
  const purchaseOrders = await PurchaseOrder.findAll({
    where: { status: { [Op.notIn]: ['cancelled'] } },
    attributes: ['id', 'supplier_id', 'total', 'currency', 'settlement_currency'],
    include: [{
      model: Supplier, as: 'supplier',
      attributes: ['id', 'name'], where: { is_active: true }
    }]
  }) as any[];

  let bcvRate: number | null = null;
  try { bcvRate = await (ExchangeRate as any).getRate('USD', 'VES'); } catch (e) {}

  if (purchaseOrders.length === 0) {
    return { bcv_rate: bcvRate, totals: { USD: 0, DIVISAS: 0, COP: 0 }, ves_needed: 0, suppliers: [] };
  }

  const poIds = purchaseOrders.map((p: any) => p.id);
  const allocations = await SupplierPaymentAllocation.findAll({
    where: { purchase_order_id: { [Op.in]: poIds } },
    attributes: ['purchase_order_id', 'allocated_amount_po_currency'],
    include: [{
      model: SupplierPayment, as: 'payment',
      where: { status: { [Op.ne]: 'cancelled' } }, attributes: []
    }]
  }) as any[];

  const paidMap: any = {};
  for (const alloc of allocations) {
    const poId = alloc.purchase_order_id;
    paidMap[poId] = (paidMap[poId] || 0) + parseFloat(alloc.allocated_amount_po_currency || 0);
  }

  const supplierMap: any = {};
  for (const po of purchaseOrders) {
    const supplierId = po.supplier_id;
    const cat = getLedgerCategory(po.currency, po.settlement_currency);
    const poTotal = parseFloat(po.total || 0);
    const poPaid = paidMap[po.id] || 0;
    const poBalance = poTotal - poPaid;

    if (!supplierMap[supplierId]) {
      supplierMap[supplierId] = { id: supplierId, name: po.supplier.name, balances: { USD: 0, DIVISAS: 0, COP: 0 } };
    }
    supplierMap[supplierId].balances[cat] = (supplierMap[supplierId].balances[cat] || 0) + poBalance;
  }

  const allPayments = await SupplierPayment.findAll({
    where: { status: { [Op.ne]: 'cancelled' } },
    attributes: ['id', 'supplier_id', 'amount', 'currency', 'exchange_rate'],
    include: [
      { model: SupplierPaymentAllocation, as: 'allocations', attributes: ['allocated_amount'] },
      { model: Supplier, as: 'supplier', attributes: ['id', 'name'], where: { is_active: true } }
    ]
  }) as any[];

  for (const pay of allPayments) {
    const totalAllocated = (pay.allocations || []).reduce(
      (sum: any, a: any) => sum + parseFloat(a.allocated_amount || 0), 0
    );
    const payAmount = parseFloat(pay.amount || 0);
    const unallocated = payAmount - totalAllocated;
    if (Math.abs(unallocated) < 0.01) continue;

    const payCurrency = pay.currency || 'USD';
    const cat = inferCategoryFromPaymentCurrency(payCurrency);
    let amountInCat = unallocated;
    if (payCurrency === 'VES' && pay.exchange_rate) {
      amountInCat = unallocated / parseFloat(pay.exchange_rate);
    }

    if (!supplierMap[pay.supplier_id]) {
      supplierMap[pay.supplier_id] = { id: pay.supplier_id, name: pay.supplier.name, balances: { USD: 0, DIVISAS: 0, COP: 0 } };
    }
    supplierMap[pay.supplier_id].balances[cat] -= amountInCat;
  }

  const suppliers = (Object.values(supplierMap) as any[])
    .map(s => {
      s.balances.USD = Math.round((s.balances.USD || 0) * 100) / 100;
      s.balances.DIVISAS = Math.round((s.balances.DIVISAS || 0) * 100) / 100;
      s.balances.COP = Math.round((s.balances.COP || 0) * 100) / 100;
      return s;
    })
    .filter(s => Math.abs(s.balances.USD) > 0.01 || Math.abs(s.balances.DIVISAS) > 0.01 || Math.abs(s.balances.COP) > 0.01)
    .sort((a, b) => {
      const totalA = Math.abs(a.balances.USD) + Math.abs(a.balances.DIVISAS) + Math.abs(a.balances.COP);
      const totalB = Math.abs(b.balances.USD) + Math.abs(b.balances.DIVISAS) + Math.abs(b.balances.COP);
      return totalB - totalA;
    });

  const totals = { USD: 0, DIVISAS: 0, COP: 0 };
  for (const s of suppliers) {
    totals.USD += s.balances.USD;
    totals.DIVISAS += s.balances.DIVISAS;
    totals.COP += s.balances.COP;
  }
  totals.USD = Math.round(totals.USD * 100) / 100;
  totals.DIVISAS = Math.round(totals.DIVISAS * 100) / 100;
  totals.COP = Math.round(totals.COP * 100) / 100;

  const vesNeeded = bcvRate ? Math.round(totals.USD * bcvRate * 100) / 100 : 0;

  return { bcv_rate: bcvRate, totals, ves_needed: vesNeeded, suppliers };
}
