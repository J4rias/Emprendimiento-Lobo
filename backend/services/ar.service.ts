import ExchangeRate from '../models/ExchangeRate';

const { sequelize } = require('../config/database');
const { computeDueDate, computeAgingBucket } = require('../services/statementService');
const bcrypt = require('bcryptjs');

// ─── Constants ────────────────────────────────────────────────────────────────

export const BUCKET_ORDER: Record<string, number> = { '+90': 0, '61_90': 1, '31_60': 2, '0_30': 3, 'vigente': 4, 'sin_termino': 5 };

export function bucketLabel(bucket: string): string {
  return ({ vigente: 'Vigente', '0_30': '0-30 días', '31_60': '31-60 días', '61_90': '61-90 días', '+90': '+90 días', sin_termino: 'Sin término' } as Record<string, string>)[bucket] || bucket;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export async function getLatestCOPRate(): Promise<number> {
  const rate = await ExchangeRate.findOne({
    where: { from_currency: 'USD', to_currency: 'COP', is_active: true },
    order: [['effective_date', 'DESC']]
  }) as any;
  return parseFloat(rate?.rate || 1);
}

// ─── AR Summary (aging por factura) ──────────────────────────────────────────

export interface ARSummaryFilters {
  bucket?: string;
  search?: string;
  vendor_id?: string;
}

export async function getARSummary(filters: ARSummaryFilters) {
  const { bucket: filterBucket, search, vendor_id } = filters;
  const copRate = await getLatestCOPRate();

  const [sales] = await sequelize.query(`
    SELECT
      s.id, s.sale_number, s.sale_date, s.total, s.paid_amount,
      s.exchange_rate, s.credit_due_date, s.customer_id, s.user_id,
      c.id as customer_id_fk, c.code as customer_code,
      c.first_name as customer_first_name, c.last_name as customer_last_name,
      c.business_name as customer_business_name, c.type as customer_type,
      c.credit_days as customer_credit_days, c.status as customer_status,
      u.id as seller_id_fk, u.first_name as seller_first_name, u.last_name as seller_last_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.sale_type = 'credit'
      AND s.status NOT IN ('cancelled', 'returned')
      AND s.deleted_at IS NULL
      AND s.paid_amount < s.total - 0.001
    LIMIT 5000
  `);

  const mappedSales = (sales as any[]).map((row) => ({
    id: row.id,
    sale_number: row.sale_number,
    sale_date: row.sale_date,
    total: row.total,
    paid_amount: row.paid_amount,
    exchange_rate: row.exchange_rate,
    credit_due_date: row.credit_due_date,
    customer_id: row.customer_id,
    user_id: row.user_id,
    customer: row.customer_id_fk ? {
      id: row.customer_id_fk,
      code: row.customer_code,
      first_name: row.customer_first_name,
      last_name: row.customer_last_name,
      business_name: row.customer_business_name,
      type: row.customer_type,
      credit_days: row.customer_credit_days,
      status: row.customer_status
    } : null,
    seller: row.seller_id_fk ? {
      id: row.seller_id_fk,
      first_name: row.seller_first_name,
      last_name: row.seller_last_name
    } : null
  }));

  const agingDist: Record<string, { count: number; amount: number }> = {
    vigente: { count: 0, amount: 0 }, '0_30': { count: 0, amount: 0 },
    '31_60': { count: 0, amount: 0 }, '61_90': { count: 0, amount: 0 },
    '+90': { count: 0, amount: 0 }, sin_termino: { count: 0, amount: 0 }
  };
  let invoices: any[] = [];

  for (const sale of mappedSales) {
    const pendingUSD = Math.max(0, parseFloat(sale.total || 0) - parseFloat(sale.paid_amount || 0));
    if (pendingUSD <= 0.001) continue;

    const creditDays = sale.customer?.credit_days || 0;
    const dueDate = computeDueDate(sale, creditDays);
    const { bucket, daysOverdue } = computeAgingBucket(dueDate);
    const rate = parseFloat(sale.exchange_rate || copRate);
    const pendingCOP = Math.round(pendingUSD * rate);

    agingDist[bucket].count++;
    agingDist[bucket].amount += pendingCOP;

    const customerName = sale.customer?.business_name ||
      `${sale.customer?.first_name || ''} ${sale.customer?.last_name || ''}`.trim() || '—';
    const vendorName = sale.seller
      ? `${sale.seller.first_name} ${sale.seller.last_name}` : '—';

    invoices.push({
      id: sale.id,
      sale_number: sale.sale_number,
      sale_date: sale.sale_date,
      due_date: dueDate,
      days_overdue: daysOverdue,
      aging_bucket: bucket,
      aging_label: bucketLabel(bucket),
      customer_id: sale.customer_id,
      customer_name: customerName,
      customer_code: sale.customer?.code,
      vendor_name: vendorName,
      vendor_id: sale.user_id,
      total_usd: parseFloat(sale.total || 0),
      paid_usd: parseFloat(sale.paid_amount || 0),
      pending_usd: pendingUSD,
      exchange_rate: rate,
      total_cop: Math.round(parseFloat(sale.total || 0) * rate),
      paid_cop: Math.round(parseFloat(sale.paid_amount || 0) * rate),
      pending_cop: pendingCOP
    });
  }

  if (filterBucket && filterBucket !== 'all') {
    invoices = invoices.filter(i => i.aging_bucket === filterBucket);
  }
  if (search) {
    const q = search.toLowerCase();
    invoices = invoices.filter(i =>
      i.sale_number.toLowerCase().includes(q) ||
      i.customer_name.toLowerCase().includes(q) ||
      (i.customer_code || '').toLowerCase().includes(q)
    );
  }
  if (vendor_id) {
    invoices = invoices.filter(i => i.vendor_id === parseInt(vendor_id));
  }

  invoices.sort((a, b) => {
    const bo = (BUCKET_ORDER[a.aging_bucket] ?? 99) - (BUCKET_ORDER[b.aging_bucket] ?? 99);
    if (bo !== 0) return bo;
    return b.pending_cop - a.pending_cop;
  });

  const totalPending = invoices.reduce((s, i) => s + i.pending_cop, 0);
  const totalInvoiced = invoices.reduce((s, i) => s + i.total_cop, 0);

  return {
    aging_distribution: Object.entries(agingDist).map(([bucket, v]) => ({
      bucket, label: bucketLabel(bucket), count: v.count, amount: v.amount,
      pct: totalPending > 0 ? Math.round((v.amount / totalPending) * 100) : 0
    })),
    totals: { total_invoiced_cop: totalInvoiced, total_pending_cop: totalPending, invoice_count: invoices.length },
    invoices
  };
}

// ─── Customer aging aggregation ───────────────────────────────────────────────

export interface CustomerAgingFilters {
  bucket?: string;
  search?: string;
}

export async function getCustomerAging(filters: CustomerAgingFilters) {
  const { bucket: filterBucket, search } = filters;
  const copRate = await getLatestCOPRate();

  const [salesData] = await sequelize.query(`
    SELECT
      s.id, s.sale_date, s.total, s.paid_amount,
      s.exchange_rate, s.credit_due_date, s.customer_id,
      c.id as customer_id_fk, c.code as customer_code,
      c.first_name as customer_first_name, c.last_name as customer_last_name,
      c.business_name as customer_business_name, c.type as customer_type,
      c.credit_days as customer_credit_days, c.status as customer_status
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.sale_type = 'credit'
      AND s.status NOT IN ('cancelled', 'returned')
      AND s.deleted_at IS NULL
      AND s.paid_amount < s.total - 0.001
    LIMIT 5000
  `);

  const [paymentsData] = await sequelize.query(`
    SELECT sp.sale_id, sp.payment_date, sp.amount, sp.currency, sp.exchange_rate
    FROM sale_payments sp
    WHERE sp.reversed_at IS NULL
  `);

  const paymentsBySale: Record<number, any[]> = {};
  for (const p of paymentsData as any[]) {
    if (!paymentsBySale[p.sale_id]) paymentsBySale[p.sale_id] = [];
    paymentsBySale[p.sale_id].push(p);
  }

  const sales = (salesData as any[]).map((row) => ({
    id: row.id,
    sale_date: row.sale_date,
    total: row.total,
    paid_amount: row.paid_amount,
    exchange_rate: row.exchange_rate,
    credit_due_date: row.credit_due_date,
    customer_id: row.customer_id,
    customer: row.customer_id_fk ? {
      id: row.customer_id_fk,
      code: row.customer_code,
      first_name: row.customer_first_name,
      last_name: row.customer_last_name,
      business_name: row.customer_business_name,
      type: row.customer_type,
      credit_days: row.customer_credit_days,
      status: row.customer_status
    } : null,
    payments: paymentsBySale[row.id] || []
  }));

  const byCustomer: Record<number, any> = {};
  for (const sale of sales) {
    const pendingUSD = Math.max(0, parseFloat(sale.total || 0) - parseFloat(sale.paid_amount || 0));
    if (pendingUSD <= 0.001) continue;
    const cid = sale.customer_id;
    const rate = parseFloat(sale.exchange_rate || copRate);
    const creditDays = sale.customer?.credit_days || 0;
    const dueDate = computeDueDate(sale, creditDays);
    const { bucket, daysOverdue } = computeAgingBucket(dueDate);

    if (!byCustomer[cid]) {
      byCustomer[cid] = {
        customer_id: cid,
        customer_name: sale.customer?.business_name ||
          `${sale.customer?.first_name || ''} ${sale.customer?.last_name || ''}`.trim() || '—',
        customer_code: sale.customer?.code,
        pending_invoices: 0,
        total_adeudado_cop: 0,
        overdue_cop: 0,
        worst_bucket: 'sin_termino',
        aging: { vigente: 0, '0_30': 0, '31_60': 0, '61_90': 0, '+90': 0, sin_termino: 0 },
        last_payment_date: null,
        blocked: false,
        blocked_reason: null
      };
    }

    const c = byCustomer[cid];
    const pendingCOP = Math.round(pendingUSD * rate);
    c.pending_invoices++;
    c.total_adeudado_cop += pendingCOP;
    c.aging[bucket] = (c.aging[bucket] || 0) + pendingCOP;
    if (daysOverdue > 0) {
      c.overdue_cop += pendingCOP;
      c.blocked = true;
      if (!c.blocked_reason || daysOverdue > (c.worst_days || 0)) {
        c.worst_days = daysOverdue;
        c.blocked_reason = `Factura vencida hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''}`;
        c.worst_bucket = bucket;
      }
    }
    if ((BUCKET_ORDER[bucket] ?? 99) < (BUCKET_ORDER[c.worst_bucket] ?? 99)) {
      c.worst_bucket = bucket;
    }

    for (const p of sale.payments || []) {
      const pd = new Date(p.payment_date);
      if (!c.last_payment_date || pd > new Date(c.last_payment_date)) {
        c.last_payment_date = p.payment_date;
      }
    }
  }

  let customers: any[] = Object.values(byCustomer);

  if (filterBucket && filterBucket !== 'all') {
    customers = customers.filter(c => c.worst_bucket === filterBucket || (filterBucket === 'overdue' && c.blocked));
  }
  if (search) {
    const q = search.toLowerCase();
    customers = customers.filter(c =>
      c.customer_name.toLowerCase().includes(q) ||
      (c.customer_code || '').toLowerCase().includes(q)
    );
  }

  customers.sort((a, b) => {
    if (a.blocked && !b.blocked) return -1;
    if (!a.blocked && b.blocked) return 1;
    return b.overdue_cop - a.overdue_cop || b.total_adeudado_cop - a.total_adeudado_cop;
  });

  const totalBlockedCount = customers.filter(c => c.blocked).length;
  const totalPendingCOP = customers.reduce((s, c) => s + c.total_adeudado_cop, 0);

  return {
    totals: { customer_count: customers.length, blocked_count: totalBlockedCount, total_pending_cop: totalPendingCOP },
    customers
  };
}

// ─── PIN management ───────────────────────────────────────────────────────────

export interface PinValidationResult {
  ok: boolean;
  locked?: boolean;
  lockedUntil?: Date;
  attemptsLeft?: number;
  message?: string;
}

export async function validateCreditPin(adminId: number, pin: string, t: any): Promise<PinValidationResult> {
  const [adminRows] = await sequelize.query(
    `SELECT id, credit_pin, credit_pin_attempts, credit_pin_locked_until FROM users WHERE id = ?`,
    { replacements: [adminId], transaction: t }
  );
  const admin = (adminRows as any[])[0];

  if (!admin?.credit_pin) {
    return { ok: false, message: 'No tienes un PIN de crédito configurado' };
  }
  if (admin.credit_pin_locked_until && new Date() < new Date(admin.credit_pin_locked_until)) {
    return { ok: false, locked: true, lockedUntil: new Date(admin.credit_pin_locked_until) };
  }

  const pinOk = await bcrypt.compare(String(pin), admin.credit_pin);
  if (!pinOk) {
    const attempts = (admin.credit_pin_attempts || 0) + 1;
    const lockedUntil = attempts >= 3 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await sequelize.query(
      `UPDATE users SET credit_pin_attempts = ?, credit_pin_locked_until = ? WHERE id = ?`,
      { replacements: [attempts, lockedUntil, adminId], transaction: t }
    );
    return { ok: false, locked: !!lockedUntil, lockedUntil: lockedUntil || undefined, attemptsLeft: 3 - attempts };
  }

  await sequelize.query(
    `UPDATE users SET credit_pin_attempts = 0, credit_pin_locked_until = NULL WHERE id = ?`,
    { replacements: [adminId], transaction: t }
  );

  return { ok: true };
}

// ─── Payment reversal ─────────────────────────────────────────────────────────

export async function reverseSalePayment(paymentId: string, adminId: number, pin: string) {
  const t = await sequelize.transaction();
  try {
    const pinResult = await validateCreditPin(adminId, pin, t);
    if (!pinResult.ok) {
      if (pinResult.locked && pinResult.lockedUntil) {
        const mins = Math.ceil((pinResult.lockedUntil.getTime() - Date.now()) / 60000);
        await t.commit(); // persist lockout counter
        throw Object.assign(new Error(`PIN bloqueado. Intenta en ${mins} minuto${mins !== 1 ? 's' : ''}`), { status: 403 });
      }
      if (pinResult.message?.includes('configurado')) {
        await t.rollback();
        throw Object.assign(new Error(pinResult.message), { status: 400 });
      }
      if (pinResult.locked) {
        await t.commit();
        throw Object.assign(new Error('PIN incorrecto. Bloqueado por 15 minutos (3 intentos fallidos)'), { status: 403 });
      }
      await t.commit();
      throw Object.assign(new Error(`PIN incorrecto. Intentos restantes: ${pinResult.attemptsLeft}`), { status: 403 });
    }

    const [payRows] = await sequelize.query(
      `SELECT sp.*, s.customer_id, s.id as sale_id FROM sale_payments sp
       JOIN sales s ON s.id = sp.sale_id
       WHERE sp.id = ? AND sp.reversed_at IS NULL
       FOR UPDATE`,
      { replacements: [paymentId], transaction: t }
    );
    if (!(payRows as any[]).length) {
      await t.rollback();
      throw Object.assign(new Error('Pago no encontrado o ya fue revertido'), { status: 404 });
    }
    const pay = (payRows as any[])[0];

    const payCreatedAt = new Date(pay.created_at);
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const withinWindow = payCreatedAt >= thirtyMinsAgo;

    if (!withinWindow) {
      const [laterPayments] = await sequelize.query(
        `SELECT COUNT(*) as cnt FROM sale_payments sp
         JOIN sales s ON s.id = sp.sale_id
         WHERE s.customer_id = ? AND s.sale_type = 'credit' AND s.status NOT IN ('cancelled')
           AND sp.created_at > (SELECT created_at FROM sale_payments WHERE id = ?)
           AND sp.reversed_at IS NULL AND sp.id != ?`,
        { replacements: [pay.customer_id, paymentId, paymentId], transaction: t }
      );
      if (parseInt((laterPayments as any[])[0].cnt) > 0) {
        await t.rollback();
        throw Object.assign(new Error('No se puede revertir: existen pagos posteriores de este cliente'), { status: 409 });
      }
    }

    await sequelize.query(
      `UPDATE sale_payments SET reversed_at = NOW(), reversed_by = ? WHERE id = ?`,
      { replacements: [adminId, paymentId], transaction: t }
    );

    const [totalPaidRows] = await sequelize.query(
      `SELECT COALESCE(SUM(
         CASE WHEN currency = 'COP' THEN amount / NULLIF(exchange_rate, 0)
              ELSE amount END
       ), 0) as total_paid_usd
       FROM sale_payments
       WHERE sale_id = ? AND reversed_at IS NULL`,
      { replacements: [pay.sale_id], transaction: t }
    );
    const newPaidUSD = parseFloat((totalPaidRows as any[])[0].total_paid_usd || 0);

    const [saleRows] = await sequelize.query(
      `SELECT total FROM sales WHERE id = ?`,
      { replacements: [pay.sale_id], transaction: t }
    );
    const saleTotal = parseFloat((saleRows as any[])[0]?.total || 0);
    const newStatus = newPaidUSD <= 0 ? 'pending' : newPaidUSD < saleTotal - 0.001 ? 'partial' : 'completed';

    await sequelize.query(
      `UPDATE sales SET paid_amount = ?, updated_at = NOW() WHERE id = ?`,
      { replacements: [newPaidUSD, pay.sale_id], transaction: t }
    );

    await t.commit();
    return { payment_id: paymentId, new_paid_amount: newPaidUSD, new_status: newStatus };
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    throw error;
  }
}
