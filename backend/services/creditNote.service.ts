import { Op } from 'sequelize';
import CreditNote from '../models/CreditNote';

const { sequelize } = require('../config/database');

export interface CreditNoteStatsFilters {
  date_from?: string;
  date_to?: string;
}

export async function getCreditNoteStats(filters: CreditNoteStatsFilters) {
  const { date_from, date_to } = filters;
  const where: any = {};

  if (date_from || date_to) {
    where.credit_note_date = {};
    if (date_from) where.credit_note_date[Op.gte] = date_from;
    if (date_to) where.credit_note_date[Op.lte] = date_to;
  }

  const totalCreditNotes = await CreditNote.count({ where });

  const creditNotesByStatus = await CreditNote.findAll({
    where,
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count'], [sequelize.fn('SUM', sequelize.col('total')), 'total_amount']],
    group: ['status']
  }) as any[];

  const creditNotesByReason = await CreditNote.findAll({
    where,
    attributes: ['reason', [sequelize.fn('COUNT', sequelize.col('id')), 'count'], [sequelize.fn('SUM', sequelize.col('total')), 'total_amount']],
    group: ['reason']
  }) as any[];

  const totalRefunded = await CreditNote.sum('refund_amount', { where: { ...where, status: 'applied' } });

  return { total_credit_notes: totalCreditNotes, credit_notes_by_status: creditNotesByStatus, credit_notes_by_reason: creditNotesByReason, total_refunded: totalRefunded || 0 };
}
