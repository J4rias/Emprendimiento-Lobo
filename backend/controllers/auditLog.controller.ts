import { Request, Response } from 'express';
import { Op } from 'sequelize';
import AuditLog from '../models/AuditLog';

const logger = require('../config/logger');

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const {
      table,
      action,
      userId,
      recordId,
      from,
      to,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    const where: any = {};

    if (table) where.table_name = table;
    if (action) where.action = action;
    if (userId) where.user_id = Number(userId);
    if (recordId) where.record_id = Number(recordId);

    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset,
    });

    res.json({
      total: count,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(count / limitNum),
      data: rows,
    });
  } catch (error) {
    logger.error('Error fetching audit logs', { error: (error as Error).message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
