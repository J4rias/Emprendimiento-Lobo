import { Op } from 'sequelize';
import SupplierPayment from '../models/SupplierPayment';
import SupplierPaymentAllocation from '../models/SupplierPaymentAllocation';
import Supplier from '../models/Supplier';
import PurchaseOrder from '../models/PurchaseOrder';
import User from '../models/User';

const { sequelize } = require('../config/database');

// ─── Number generator ─────────────────────────────────────────────────────────

export async function generatePaymentNumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const prefix = `PP-${year}${month}${day}`;

  const lastPayment = await SupplierPayment.findOne({
    where: { payment_number: { [Op.like]: `${prefix}%` } },
    order: [['payment_number', 'DESC']]
  }) as any;

  let sequence = 1;
  if (lastPayment) {
    sequence = parseInt(lastPayment.payment_number.split('-')[2]) + 1;
  }
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

// ─── getPaymentStats ──────────────────────────────────────────────────────────

export interface PaymentStatsFilters {
  date_from?: string;
  date_to?: string;
  supplier_id?: string;
}

export async function getPaymentStats(filters: PaymentStatsFilters) {
  const { date_from, date_to, supplier_id } = filters;
  const where: any = {};

  if (date_from || date_to) {
    where.payment_date = {};
    if (date_from) where.payment_date[Op.gte] = date_from;
    if (date_to) where.payment_date[Op.lte] = date_to;
  }
  if (supplier_id) where.supplier_id = supplier_id;

  const totalPayments = await SupplierPayment.count({ where });

  const totalByCurrency = await SupplierPayment.findAll({
    where,
    attributes: [
      'currency',
      [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'payment_count']
    ],
    group: ['currency']
  }) as any[];

  const paymentsByMethod = await SupplierPayment.findAll({
    where,
    attributes: [
      'payment_method',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'total']
    ],
    group: ['payment_method']
  }) as any[];

  const recentPayments = await SupplierPayment.findAll({
    where,
    include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name', 'tax_id'] }],
    order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
    limit: 5
  }) as any[];

  return { total_payments: totalPayments, total_by_currency: totalByCurrency, payments_by_method: paymentsByMethod, recent_payments: recentPayments };
}

// ─── getPaymentsByPO ──────────────────────────────────────────────────────────

export async function getPaymentsByPO(poId: string | number) {
  const purchaseOrder = await PurchaseOrder.findByPk(poId, {
    include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name'] }]
  }) as any;
  if (!purchaseOrder) return null;

  const allocations = await SupplierPaymentAllocation.findAll({
    where: { purchase_order_id: poId },
    include: [{
      model: SupplierPayment,
      as: 'payment',
      where: { status: { [Op.ne]: 'cancelled' } },
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'first_name', 'last_name'] }]
    }],
    order: [['created_at', 'DESC']]
  }) as any[];

  const totalPaidInPOCurrency = allocations.reduce(
    (sum: number, a: any) => sum + parseFloat(a.allocated_amount_po_currency || 0), 0
  );
  const poTotal = parseFloat(purchaseOrder.total || 0);
  const saldoPendiente = poTotal - totalPaidInPOCurrency;

  return {
    purchase_order: {
      id: purchaseOrder.id, order_number: purchaseOrder.order_number,
      total: purchaseOrder.total, currency: purchaseOrder.currency || 'USD',
      status: purchaseOrder.status, supplier: purchaseOrder.supplier
    },
    allocations,
    summary: {
      total_pagado: totalPaidInPOCurrency, total_pagado_currency: purchaseOrder.currency || 'USD',
      saldo_pendiente: saldoPendiente, saldo_pendiente_currency: purchaseOrder.currency || 'USD',
      esta_pagada_completa: saldoPendiente <= 0.01
    }
  };
}

// ─── getPayableBalance ────────────────────────────────────────────────────────

export async function getPayableBalance(supplierId: string | number) {
  const supplier = await Supplier.findByPk(supplierId) as any;
  if (!supplier) return null;

  const receivedPOs = await PurchaseOrder.findAll({
    where: { supplier_id: supplierId, status: { [Op.in]: ['received', 'partially_received'] } },
    attributes: ['id', 'order_number', 'total', 'currency', 'status']
  }) as any[];

  const poIds = receivedPOs.map((po: any) => po.id);

  const allAllocations = await SupplierPaymentAllocation.findAll({
    where: { purchase_order_id: { [Op.in]: poIds } },
    include: [{
      model: SupplierPayment,
      as: 'payment',
      where: { status: { [Op.ne]: 'cancelled' } },
      required: true,
      attributes: []
    }],
    attributes: ['purchase_order_id', 'allocated_amount_po_currency']
  }) as any[];

  const allocationsByPO: Record<number, any[]> = {};
  for (const alloc of allAllocations) {
    const pid = alloc.purchase_order_id;
    if (!allocationsByPO[pid]) allocationsByPO[pid] = [];
    allocationsByPO[pid].push(alloc);
  }

  const posWithBalance = receivedPOs.map((po: any) => {
    const allocations = allocationsByPO[po.id] || [];
    const totalPaid = allocations.reduce(
      (sum: number, a: any) => sum + parseFloat(a.allocated_amount_po_currency || 0), 0
    );
    const poTotal = parseFloat(po.total || 0);
    return {
      id: po.id,
      order_number: po.order_number,
      total: poTotal,
      currency: po.currency || 'USD',
      status: po.status,
      total_paid: totalPaid,
      balance: poTotal - totalPaid
    };
  });

  const byCurrency: any = {};
  for (const po of posWithBalance) {
    if (!byCurrency[po.currency]) byCurrency[po.currency] = { total_ocs: 0, total_paid: 0, balance: 0 };
    byCurrency[po.currency].total_ocs += po.total;
    byCurrency[po.currency].total_paid += po.total_paid;
    byCurrency[po.currency].balance += po.balance;
  }

  return { supplier: { id: supplier.id, name: supplier.name }, summary_by_currency: byCurrency, purchase_orders: posWithBalance };
}

// ─── getSupplierCreditBalance ─────────────────────────────────────────────────

export async function getSupplierCreditBalance(supplierId: string | number) {
  const supplier = await Supplier.findByPk(supplierId) as any;
  if (!supplier) return null;

  const payments = await SupplierPayment.findAll({
    where: { supplier_id: supplierId, status: { [Op.ne]: 'cancelled' } },
    include: [{ model: SupplierPaymentAllocation, as: 'allocations' }]
  }) as any[];

  const creditByCurrency: any = {};
  payments.forEach((p: any) => {
    const cur = p.currency || 'USD';
    if (!creditByCurrency[cur]) creditByCurrency[cur] = { total_payments: 0, total_allocated: 0, available_credit: 0 };
    const allocSum = p.allocations.reduce((sum: any, a: any) => sum + parseFloat(a.allocated_amount || 0), 0);
    const unallocated = parseFloat(p.amount) - allocSum;
    creditByCurrency[cur].total_payments += parseFloat(p.amount);
    creditByCurrency[cur].total_allocated += allocSum;
    if (unallocated > 0.001) creditByCurrency[cur].available_credit += unallocated;
  });

  return creditByCurrency;
}
