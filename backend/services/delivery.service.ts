import { Op } from 'sequelize';
import Delivery from '../models/Delivery';

const { sequelize } = require('../config/database');

export interface DeliveryStatsFilters {
  date_from?: string;
  date_to?: string;
}

export async function getDeliveryStats(filters: DeliveryStatsFilters) {
  const { date_from, date_to } = filters;
  const where: any = {};

  if (date_from || date_to) {
    where.scheduled_date = {};
    if (date_from) where.scheduled_date[Op.gte] = date_from;
    if (date_to) where.scheduled_date[Op.lte] = date_to;
  }

  const totalDeliveries = await Delivery.count({ where });

  const deliveriesByStatus = await Delivery.findAll({
    where,
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status']
  });

  const deliveriesByMethod = await Delivery.findAll({
    where,
    attributes: ['delivery_method', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['delivery_method']
  });

  const pendingDeliveries = await Delivery.count({ where: { ...where, status: 'pending' } });
  const inTransitDeliveries = await Delivery.count({ where: { ...where, status: 'in_transit' } });

  return { total_deliveries: totalDeliveries, pending_deliveries: pendingDeliveries, in_transit_deliveries: inTransitDeliveries, deliveries_by_status: deliveriesByStatus, deliveries_by_method: deliveriesByMethod };
}
