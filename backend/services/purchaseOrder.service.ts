import { Op } from 'sequelize';
import PurchaseOrder from '../models/PurchaseOrder';

const { sequelize } = require('../config/database');

// ─── generateOrderNumber ──────────────────────────────────────────────────────

export async function generateOrderNumber(transaction: any): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const prefix = `OC-${year}${month}${day}`;

  const lastOrder = await PurchaseOrder.findOne({
    where: { order_number: { [Op.like]: `${prefix}%` } },
    order: [['order_number', 'DESC']],
    lock: transaction.LOCK.UPDATE,
    transaction
  }) as any;

  let sequence = 1;
  if (lastOrder) {
    sequence = parseInt(lastOrder.order_number.split('-').pop()) + 1;
  }
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

// ─── getPurchaseOrderStats ────────────────────────────────────────────────────

export interface POStatsFilters {
  date_from?: string;
  date_to?: string;
  supplier_id?: string;
}

export async function getPurchaseOrderStats(filters: POStatsFilters) {
  const { date_from, date_to, supplier_id } = filters;
  const where: any = {};
  if (supplier_id) where.supplier_id = supplier_id;
  if (date_from && date_to) where.order_date = { [Op.between]: [date_from, date_to] };

  const totalOrders = await PurchaseOrder.count({ where });

  const ordersByStatus = await PurchaseOrder.findAll({
    where,
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('total')), 'total_amount']
    ],
    group: ['status']
  }) as any[];

  const valueByCurrency = await PurchaseOrder.findAll({
    where,
    attributes: ['currency', [sequelize.fn('SUM', sequelize.col('total')), 'total']],
    group: ['currency']
  }) as any[];

  const pendingOrders = await PurchaseOrder.count({
    where: { ...where, status: { [Op.in]: ['draft', 'sent', 'confirmed', 'partially_received'] } }
  });

  return { total_orders: totalOrders, pending_orders: pendingOrders, value_by_currency: valueByCurrency, by_status: ordersByStatus };
}
