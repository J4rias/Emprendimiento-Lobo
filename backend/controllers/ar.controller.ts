import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

const { sequelize } = require('../config/database');
const { buildCustomerStatement, getCustomerCreditBlock, computeDueDate, computeAgingBucket } = require('../services/statementService');
const bcrypt = require('bcryptjs');
const {
  getARSummary, getCustomerAging, reverseSalePayment, validateCreditPin,
  bucketLabel, getLatestCOPRate
} = require('../services/ar.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toCSVRow(row: any[]): string {
  return row.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
}

// ─── Resumen general ─────────────────────────────────────────────────────────

async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { bucket, search, vendor_id } = req.query as Record<string, string>;
    const data = await getARSummary({ bucket, search, vendor_id });
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

// ─── Clientes con saldo ──────────────────────────────────────────────────────

async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const { bucket, search } = req.query as Record<string, string>;
    const data = await getCustomerAging({ bucket, search });
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

// ─── Statement de cliente ────────────────────────────────────────────────────

async function getCustomerStatement(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await buildCustomerStatement(parseInt(id));
    if (!result) return res.status(404).json({ message: 'Cliente no encontrado' });

    const block = await getCustomerCreditBlock(parseInt(id));
    res.json({ data: { ...result, credit_block: block } });
  } catch (error) {
    next(error);
  }
}

// ─── Reversión de abono ──────────────────────────────────────────────────────

async function reversePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { paymentId } = req.params;
    const { pin } = req.body;
    const adminId = (req as any).user.id;

    if (!pin) {
      return res.status(400).json({ message: 'PIN requerido' });
    }

    const result = await reverseSalePayment(paymentId, adminId, pin);
    res.json({ message: 'Abono revertido exitosamente', data: result });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

// ─── Gestión de PIN ──────────────────────────────────────────────────────────

async function setAdminPin(req: Request, res: Response, next: NextFunction) {
  try {
    const { pin } = req.body;

    if (!(req as any).user?.id) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ message: 'El PIN debe ser numérico de 4 a 6 dígitos' });
    }

    const hashed = await bcrypt.hash(String(pin), 10);
    await sequelize.query(
      `UPDATE users SET credit_pin = ?, credit_pin_attempts = 0, credit_pin_locked_until = NULL WHERE id = ?`,
      { replacements: [hashed, (req as any).user.id] }
    );

    res.json({ message: 'PIN de crédito configurado exitosamente' });
  } catch (error) {
    next(error);
  }
}

async function validateAdminPin(req: Request, res: Response, next: NextFunction) {
  try {
    const { pin } = req.body;
    const admin = await User.findByPk((req as any).user.id) as any;
    if (!admin?.credit_pin) {
      return res.status(400).json({ message: 'No tienes un PIN configurado', has_pin: false });
    }
    if (admin.credit_pin_locked_until && new Date() < new Date(admin.credit_pin_locked_until)) {
      const mins = Math.ceil((new Date(admin.credit_pin_locked_until).getTime() - new Date().getTime()) / 60000);
      return res.status(403).json({ message: `PIN bloqueado por ${mins} minuto${mins !== 1 ? 's' : ''}` });
    }
    const ok = await bcrypt.compare(String(pin), admin.credit_pin);
    if (!ok) {
      const attempts = (admin.credit_pin_attempts || 0) + 1;
      const lockedUntil = attempts >= 3 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await sequelize.query(
        `UPDATE users SET credit_pin_attempts = ?, credit_pin_locked_until = ? WHERE id = ?`,
        { replacements: [attempts, lockedUntil, (req as any).user.id] }
      );
      if (lockedUntil) return res.status(403).json({ message: 'PIN incorrecto. Bloqueado por 15 minutos (3 intentos fallidos)' });
      return res.status(403).json({ message: `PIN incorrecto. Intentos restantes: ${3 - attempts}` });
    }

    await sequelize.query(
      `UPDATE users SET credit_pin_attempts = 0, credit_pin_locked_until = NULL WHERE id = ?`,
      { replacements: [(req as any).user.id] }
    );

    res.json({ message: 'PIN válido', has_pin: true });
  } catch (error) {
    next(error);
  }
}

// ─── Estado PIN ──────────────────────────────────────────────────────────────

async function getAdminPinStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await User.findByPk((req as any).user.id, { attributes: ['credit_pin', 'credit_pin_locked_until'] }) as any;
    const locked = admin?.credit_pin_locked_until && new Date() < new Date(admin.credit_pin_locked_until);
    res.json({ data: { has_pin: !!admin?.credit_pin, is_locked: !!locked } });
  } catch (error) {
    next(error);
  }
}

// ─── Exportar CSV ────────────────────────────────────────────────────────────

async function exportInvoicesCSV(req: Request, res: Response, next: NextFunction) {
  try {
    const { bucket: filterBucket, search } = req.query as Record<string, string>;
    const copRate = await getLatestCOPRate();

    const [sales] = await sequelize.query(`
      SELECT
        s.id, s.sale_number, s.sale_date, s.total, s.paid_amount,
        s.exchange_rate, s.credit_due_date, s.customer_id, s.user_id,
        c.code as customer_code,
        c.first_name as customer_first_name, c.last_name as customer_last_name,
        c.business_name as customer_business_name,
        c.credit_days as customer_credit_days,
        u.first_name as seller_first_name, u.last_name as seller_last_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.sale_type IN ('credit', 'mixed', 'pos_pending')
        AND s.status NOT IN ('cancelled', 'returned')
        AND s.deleted_at IS NULL
        AND s.paid_amount < s.total - 0.001
      LIMIT 5000
    `);

    let invoices: any[] = [];
    for (const sale of (sales as any[])) {
      const pendingUSD = Math.max(0, parseFloat(sale.total || 0) - parseFloat(sale.paid_amount || 0));
      if (pendingUSD <= 0.001) continue;

      const creditDays = sale.customer_credit_days || 0;
      const dueDate = computeDueDate({ ...sale, credit_due_date: sale.credit_due_date }, creditDays);
      const { bucket, daysOverdue } = computeAgingBucket(dueDate);
      const rate = parseFloat(sale.exchange_rate || copRate);
      const customerName = sale.customer_business_name || `${sale.customer_first_name || ''} ${sale.customer_last_name || ''}`.trim() || '—';
      const vendorName = sale.seller_first_name ? `${sale.seller_first_name} ${sale.seller_last_name}` : '—';

      invoices.push({
        sale_number: sale.sale_number,
        sale_date: sale.sale_date,
        customer_name: customerName,
        vendor_name: vendorName,
        total_cop: Math.round(parseFloat(sale.total || 0) * rate),
        paid_cop: Math.round(parseFloat(sale.paid_amount || 0) * rate),
        pending_cop: Math.round(pendingUSD * rate),
        due_date: dueDate,
        days_overdue: daysOverdue,
        aging_bucket: bucket
      });
    }

    if (filterBucket && filterBucket !== 'all') {
      invoices = invoices.filter((i: any) => i.aging_bucket === filterBucket);
    }
    if (search) {
      const q = search.toLowerCase();
      invoices = invoices.filter((i: any) => i.customer_name.toLowerCase().includes(q) || (i.sale_number || '').includes(q));
    }

    const headers = ['Factura', 'Fecha', 'Cliente', 'Monto', 'Pagado', 'Pendiente', 'Vencimiento', 'Días Vencida', 'Estado'];
    const rows = invoices.map((i: any) => [
      i.sale_number, new Date(i.sale_date).toLocaleDateString('es-CO'),
      i.customer_name, i.total_cop, i.paid_cop, i.pending_cop,
      i.due_date ? new Date(i.due_date).toLocaleDateString('es-CO') : 'Sin término',
      i.days_overdue || 0, bucketLabel(i.aging_bucket)
    ]);

    const csv = [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cuentas-por-cobrar-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
}

async function exportCustomersCSV(req: Request, res: Response, next: NextFunction) {
  try {
    const { bucket: filterBucket, search } = req.query as Record<string, string>;
    const copRate = await getLatestCOPRate();

    const [sales] = await sequelize.query(`
      SELECT
        s.total, s.paid_amount, s.exchange_rate, s.credit_due_date,
        s.customer_id,
        c.code as customer_code,
        c.first_name as customer_first_name, c.last_name as customer_last_name,
        c.business_name as customer_business_name,
        c.credit_days as customer_credit_days
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.sale_type IN ('credit', 'mixed', 'pos_pending')
        AND s.status NOT IN ('cancelled', 'returned')
        AND s.deleted_at IS NULL
        AND s.paid_amount < s.total - 0.001
      LIMIT 5000
    `);

    const byCustomer: Record<number, any> = {};
    for (const sale of (sales as any[])) {
      const pendingUSD = Math.max(0, parseFloat(sale.total || 0) - parseFloat(sale.paid_amount || 0));
      if (pendingUSD <= 0.001) continue;

      const cid = sale.customer_id;
      const rate = parseFloat(sale.exchange_rate || copRate);
      const dueDate = computeDueDate({ ...sale, credit_due_date: sale.credit_due_date }, sale.customer_credit_days || 0);
      const { daysOverdue } = computeAgingBucket(dueDate);

      if (!byCustomer[cid]) {
        byCustomer[cid] = {
          customer_name: sale.customer_business_name || `${sale.customer_first_name || ''} ${sale.customer_last_name || ''}`.trim() || '—',
          customer_code: sale.customer_code,
          pending_invoices: 0,
          total_adeudado_cop: 0,
          overdue_cop: 0,
          blocked: false
        };
      }

      const c = byCustomer[cid];
      const pendingCOP = Math.round(pendingUSD * rate);
      c.pending_invoices++;
      c.total_adeudado_cop += pendingCOP;
      if (daysOverdue > 0) { c.overdue_cop += pendingCOP; c.blocked = true; }
    }

    let customers = Object.values(byCustomer);
    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter((c: any) => c.customer_name.toLowerCase().includes(q) || (c.customer_code || '').toLowerCase().includes(q));
    }
    customers.sort((a: any, b: any) => b.overdue_cop - a.overdue_cop || b.total_adeudado_cop - a.total_adeudado_cop);

    const headers = ['Cliente', 'Código', 'Facturas Pend.', 'Total Adeudado', 'Vencido', 'Estado'];
    const rows = customers.map((c: any) => [c.customer_name, c.customer_code, c.pending_invoices, c.total_adeudado_cop, c.overdue_cop, c.blocked ? 'BLOQUEADO' : 'Al día']);

    const csv = [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clientes-cartera-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
}

export {
  getSummary,
  getCustomers,
  getCustomerStatement,
  reversePayment,
  setAdminPin,
  validateAdminPin,
  getAdminPinStatus,
  exportInvoicesCSV,
  exportCustomersCSV
};
