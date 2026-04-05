/**
 * ar.controller.js — Módulo Cuentas por Cobrar (Beta)
 * Todas las operaciones AR: resumen, clientes, statement, reversión, PIN.
 */
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { User, Sale, SalePayment, Customer, ExchangeRate } = require('../models');
const { buildCustomerStatement, getCustomerCreditBlock, computeDueDate, computeAgingBucket } = require('../services/statementService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BUCKET_ORDER = { '+90': 0, '61_90': 1, '31_60': 2, '0_30': 3, 'vigente': 4, 'sin_termino': 5 };

function bucketLabel(bucket) {
  return { vigente: 'Vigente', '0_30': '0-30 días', '31_60': '31-60 días', '61_90': '61-90 días', '+90': '+90 días', sin_termino: 'Sin término' }[bucket] || bucket;
}

function toCSVRow(row) {
  return row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
}

// Obtiene la tasa COP más reciente
async function getLatestCOPRate() {
  const rate = await ExchangeRate.findOne({
    where: { from_currency: 'USD', to_currency: 'COP', is_active: true },
    order: [['effective_date', 'DESC']]
  });
  return parseFloat(rate?.rate || 1);
}

// ─── Resumen general ─────────────────────────────────────────────────────────

async function getSummary(req, res, next) {
  try {
    const { bucket: filterBucket, search, vendor_id } = req.query;
    const copRate = await getLatestCOPRate();

    // Todas las ventas a crédito con saldo pendiente - usando raw SQL
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

    // Mapear resultados a objetos
    const mappedSales = sales.map(row => ({
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

    // Enriquecer con aging y filtrar solo con saldo pendiente
    const agingDist = { vigente: { count: 0, amount: 0 }, '0_30': { count: 0, amount: 0 }, '31_60': { count: 0, amount: 0 }, '61_90': { count: 0, amount: 0 }, '+90': { count: 0, amount: 0 }, sin_termino: { count: 0, amount: 0 } };
    let invoices = [];

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
        `${sale.customer?.first_name || ''} ${sale.customer?.last_name || ''}`.trim() ||
        '—';
      const vendorName = sale.seller
        ? `${sale.seller.first_name} ${sale.seller.last_name}`
        : '—';

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

    // Filtros opcionales
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

    // Ordenar: más vencidas primero
    invoices.sort((a, b) => {
      const bo = (BUCKET_ORDER[a.aging_bucket] ?? 99) - (BUCKET_ORDER[b.aging_bucket] ?? 99);
      if (bo !== 0) return bo;
      return b.pending_cop - a.pending_cop;
    });

    const totalPending = invoices.reduce((s, i) => s + i.pending_cop, 0);
    const totalInvoiced = invoices.reduce((s, i) => s + i.total_cop, 0);

    res.json({
      success: true,
      data: {
        aging_distribution: Object.entries(agingDist).map(([bucket, v]) => ({
          bucket, label: bucketLabel(bucket), count: v.count, amount: v.amount,
          pct: totalPending > 0 ? Math.round((v.amount / totalPending) * 100) : 0
        })),
        totals: { total_invoiced_cop: totalInvoiced, total_pending_cop: totalPending, invoice_count: invoices.length },
        invoices
      }
    });
  } catch (error) {
    next(error);
  }
}

// ─── Clientes con saldo ──────────────────────────────────────────────────────

async function getCustomers(req, res, next) {
  try {
    const { bucket: filterBucket, search } = req.query;
    const copRate = await getLatestCOPRate();

    // Obtener ventas con clientes y pagos
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

    // Obtener pagos
    const [paymentsData] = await sequelize.query(`
      SELECT sp.sale_id, sp.payment_date, sp.amount, sp.currency, sp.exchange_rate
      FROM sale_payments sp
      WHERE sp.reversed_at IS NULL
    `);

    // Mapear pagos por sale_id
    const paymentsBySale = {};
    for (const p of paymentsData) {
      if (!paymentsBySale[p.sale_id]) paymentsBySale[p.sale_id] = [];
      paymentsBySale[p.sale_id].push(p);
    }

    // Mapear resultados a objetos con pagos
    const sales = salesData.map(row => ({
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

    // Agrupar por cliente
    const byCustomer = {};
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
          customer_name: sale.customer?.business_name || `${sale.customer?.first_name || ''} ${sale.customer?.last_name || ''}`.trim() || '—',
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

      // Último pago
      for (const p of sale.payments || []) {
        const pd = new Date(p.payment_date);
        if (!c.last_payment_date || pd > new Date(c.last_payment_date)) {
          c.last_payment_date = p.payment_date;
        }
      }
    }

    let customers = Object.values(byCustomer);

    // Filtros
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

    // Orden: bloqueados primero, luego por monto vencido desc
    customers.sort((a, b) => {
      if (a.blocked && !b.blocked) return -1;
      if (!a.blocked && b.blocked) return 1;
      return b.overdue_cop - a.overdue_cop || b.total_adeudado_cop - a.total_adeudado_cop;
    });

    const totalBlockedCount = customers.filter(c => c.blocked).length;
    const totalPendingCOP = customers.reduce((s, c) => s + c.total_adeudado_cop, 0);

    res.json({
      success: true,
      data: {
        totals: { customer_count: customers.length, blocked_count: totalBlockedCount, total_pending_cop: totalPendingCOP },
        customers
      }
    });
  } catch (error) {
    next(error);
  }
}

// ─── Statement de cliente ────────────────────────────────────────────────────

async function getCustomerStatement(req, res, next) {
  try {
    const { id } = req.params;
    const result = await buildCustomerStatement(parseInt(id));
    if (!result) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });

    const block = await getCustomerCreditBlock(parseInt(id));
    res.json({ success: true, data: { ...result, credit_block: block } });
  } catch (error) {
    next(error);
  }
}

// ─── Reversión de abono ──────────────────────────────────────────────────────

async function reversePayment(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const { paymentId } = req.params;
    const { pin } = req.body;
    const adminId = req.user.id;

    if (!pin) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'PIN requerido' });
    }

    // 1. Validar PIN del admin (con lockout)
    const [adminRows] = await sequelize.query(
      `SELECT id, credit_pin, credit_pin_attempts, credit_pin_locked_until FROM users WHERE id = ?`,
      { replacements: [adminId], transaction: t }
    );
    const admin = adminRows[0];
    if (!admin?.credit_pin) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'No tienes un PIN de crédito configurado' });
    }
    if (admin.credit_pin_locked_until && new Date() < new Date(admin.credit_pin_locked_until)) {
      await t.rollback();
      const mins = Math.ceil((new Date(admin.credit_pin_locked_until) - new Date()) / 60000);
      return res.status(403).json({ success: false, message: `PIN bloqueado. Intenta en ${mins} minuto${mins !== 1 ? 's' : ''}` });
    }

    const pinOk = await bcrypt.compare(String(pin), admin.credit_pin);
    if (!pinOk) {
      const attempts = (admin.credit_pin_attempts || 0) + 1;
      const lockedUntil = attempts >= 3 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await sequelize.query(
        `UPDATE users SET credit_pin_attempts = ?, credit_pin_locked_until = ? WHERE id = ?`,
        { replacements: [attempts, lockedUntil, adminId], transaction: t }
      );
      await t.commit();
      if (lockedUntil) return res.status(403).json({ success: false, message: 'PIN incorrecto. Bloqueado por 15 minutos (3 intentos fallidos)' });
      return res.status(403).json({ success: false, message: `PIN incorrecto. Intentos restantes: ${3 - attempts}` });
    }

    // Reset intentos
    await sequelize.query(
      `UPDATE users SET credit_pin_attempts = 0, credit_pin_locked_until = NULL WHERE id = ?`,
      { replacements: [adminId], transaction: t }
    );

    // 2. Obtener el pago (SELECT FOR UPDATE)
    const [payRows] = await sequelize.query(
      `SELECT sp.*, s.customer_id, s.id as sale_id FROM sale_payments sp
       JOIN sales s ON s.id = sp.sale_id
       WHERE sp.id = ? AND sp.reversed_at IS NULL
       FOR UPDATE`,
      { replacements: [paymentId], transaction: t }
    );
    if (!payRows.length) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Pago no encontrado o ya fue revertido' });
    }
    const pay = payRows[0];

    // 3. Verificar reglas de reversión
    const payCreatedAt = new Date(pay.created_at);
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const withinWindow = payCreatedAt >= thirtyMinsAgo;

    if (!withinWindow) {
      // Comparar created_at directamente en SQL para evitar problemas de timezone
      const [laterPayments] = await sequelize.query(
        `SELECT COUNT(*) as cnt FROM sale_payments sp
         JOIN sales s ON s.id = sp.sale_id
         WHERE s.customer_id = ? AND s.sale_type = 'credit' AND s.status NOT IN ('cancelled')
           AND sp.created_at > (SELECT created_at FROM sale_payments WHERE id = ?)
           AND sp.reversed_at IS NULL AND sp.id != ?`,
        { replacements: [pay.customer_id, paymentId, paymentId], transaction: t }
      );
      if (parseInt(laterPayments[0].cnt) > 0) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: 'No se puede revertir: existen pagos posteriores de este cliente'
        });
      }
    }

    // 4. Revertir: marcar el pago como revertido
    await sequelize.query(
      `UPDATE sale_payments SET reversed_at = NOW(), reversed_by = ? WHERE id = ?`,
      { replacements: [adminId, paymentId], transaction: t }
    );

    // 5. Recalcular paid_amount de la venta
    const [totalPaidRows] = await sequelize.query(
      `SELECT COALESCE(SUM(
         CASE WHEN currency = 'COP' THEN amount / NULLIF(exchange_rate, 0)
              ELSE amount END
       ), 0) as total_paid_usd
       FROM sale_payments
       WHERE sale_id = ? AND reversed_at IS NULL`,
      { replacements: [pay.sale_id], transaction: t }
    );
    const newPaidUSD = parseFloat(totalPaidRows[0].total_paid_usd || 0);

    const [saleRows] = await sequelize.query(
      `SELECT total FROM sales WHERE id = ?`,
      { replacements: [pay.sale_id], transaction: t }
    );
    const saleTotal = parseFloat(saleRows[0]?.total || 0);
    const newStatus = newPaidUSD <= 0 ? 'pending' : newPaidUSD < saleTotal - 0.001 ? 'partial' : 'completed';

    await sequelize.query(
      `UPDATE sales SET paid_amount = ?, updated_at = NOW() WHERE id = ?`,
      { replacements: [newPaidUSD, pay.sale_id], transaction: t }
    );

    await t.commit();
    res.json({ success: true, message: 'Abono revertido exitosamente', data: { payment_id: paymentId, new_paid_amount: newPaidUSD, new_status: newStatus } });
  } catch (error) {
    await t.rollback();
    next(error);
  }
}

// ─── Gestión de PIN ──────────────────────────────────────────────────────────

async function setAdminPin(req, res, next) {
  try {
    const { pin } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ success: false, message: 'El PIN debe ser numérico de 4 a 6 dígitos' });
    }

    const hashed = await bcrypt.hash(String(pin), 10);
    await sequelize.query(
      `UPDATE users SET credit_pin = ?, credit_pin_attempts = 0, credit_pin_locked_until = NULL WHERE id = ?`,
      { replacements: [hashed, req.user.id] }
    );

    res.json({ success: true, message: 'PIN de crédito configurado exitosamente' });
  } catch (error) {
    next(error);
  }
}

async function validateAdminPin(req, res, next) {
  try {
    const { pin } = req.body;
    const admin = await User.findByPk(req.user.id);
    if (!admin?.credit_pin) {
      return res.status(400).json({ success: false, message: 'No tienes un PIN configurado', has_pin: false });
    }
    if (admin.credit_pin_locked_until && new Date() < new Date(admin.credit_pin_locked_until)) {
      const mins = Math.ceil((new Date(admin.credit_pin_locked_until) - new Date()) / 60000);
      return res.status(403).json({ success: false, message: `PIN bloqueado por ${mins} minuto${mins !== 1 ? 's' : ''}` });
    }
    const ok = await bcrypt.compare(String(pin), admin.credit_pin);
    if (!ok) {
      const attempts = (admin.credit_pin_attempts || 0) + 1;
      const lockedUntil = attempts >= 3 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await admin.update({ credit_pin_attempts: attempts, credit_pin_locked_until: lockedUntil });
      if (lockedUntil) return res.status(403).json({ success: false, message: 'PIN bloqueado por 15 minutos' });
      return res.status(403).json({ success: false, message: `PIN incorrecto. Intentos: ${attempts}/3` });
    }
    await admin.update({ credit_pin_attempts: 0, credit_pin_locked_until: null });
    res.json({ success: true, message: 'PIN válido' });
  } catch (error) {
    next(error);
  }
}

async function getAdminPinStatus(req, res, next) {
  try {
    const admin = await User.findByPk(req.user.id, { attributes: ['credit_pin', 'credit_pin_locked_until'] });
    const locked = admin?.credit_pin_locked_until && new Date() < new Date(admin.credit_pin_locked_until);
    res.json({ success: true, data: { has_pin: !!admin?.credit_pin, is_locked: !!locked } });
  } catch (error) {
    next(error);
  }
}

// ─── Exportar CSV ────────────────────────────────────────────────────────────

async function exportInvoicesCSV(req, res, next) {
  try {
    const { bucket: filterBucket, search, vendor_id } = req.query;
    const copRate = await getLatestCOPRate();

    // Ejecutar la misma lógica de getSummary directamente
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

    const invoices = [];
    for (const sale of sales) {
      const pendingUSD = Math.max(0, parseFloat(sale.total || 0) - parseFloat(sale.paid_amount || 0));
      if (pendingUSD <= 0.001) continue;

      const creditDays = sale.customer_credit_days || 0;
      const dueDate = computeDueDate({ ...sale, credit_due_date: sale.credit_due_date }, creditDays);
      const { bucket } = computeAgingBucket(dueDate);
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
        days_overdue: computeAgingBucket(dueDate).daysOverdue,
        aging_bucket: bucket
      });
    }

    // Aplicar filtros opcionales
    if (filterBucket && filterBucket !== 'all') {
      invoices.filter(i => i.aging_bucket === filterBucket);
    }
    if (search) {
      const q = search.toLowerCase();
      invoices.filter(i => i.customer_name.toLowerCase().includes(q) || (i.sale_number || '').includes(q));
    }

    const headers = ['Factura', 'Fecha', 'Cliente', 'Monto', 'Pagado', 'Pendiente', 'Vencimiento', 'Días Vencida', 'Estado'];
    const rows = invoices.map(i => [
      i.sale_number, new Date(i.sale_date).toLocaleDateString('es-CO'),
      i.customer_name,
      i.total_cop, i.paid_cop, i.pending_cop,
      i.due_date ? new Date(i.due_date).toLocaleDateString('es-CO') : 'Sin término',
      i.days_overdue || 0,
      bucketLabel(i.aging_bucket)
    ]);

    const csv = [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cuentas-por-cobrar-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
}

async function exportCustomersCSV(req, res, next) {
  try {
    const { bucket: filterBucket, search } = req.query;
    const copRate = await getLatestCOPRate();

    // Ejecutar la misma lógica de getCustomers directamente
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

    const byCustomer = {};
    for (const sale of sales) {
      const pendingUSD = Math.max(0, parseFloat(sale.total || 0) - parseFloat(sale.paid_amount || 0));
      if (pendingUSD <= 0.001) continue;

      const cid = sale.customer_id;
      const rate = parseFloat(sale.exchange_rate || copRate);
      const creditDays = sale.customer_credit_days || 0;
      const dueDate = computeDueDate({ ...sale, credit_due_date: sale.credit_due_date }, creditDays);
      const { bucket, daysOverdue } = computeAgingBucket(dueDate);

      if (!byCustomer[cid]) {
        byCustomer[cid] = {
          customer_id: cid,
          customer_name: sale.customer_business_name || `${sale.customer_first_name || ''} ${sale.customer_last_name || ''}`.trim() || '—',
          customer_code: sale.customer_code,
          pending_invoices: 0,
          total_adeudado_cop: 0,
          overdue_cop: 0,
          worst_bucket: 'sin_termino',
          last_payment_date: null,
          blocked: false,
          blocked_reason: null
        };
      }

      const c = byCustomer[cid];
      const pendingCOP = Math.round(pendingUSD * rate);
      c.pending_invoices++;
      c.total_adeudado_cop += pendingCOP;
      if (daysOverdue > 0) {
        c.overdue_cop += pendingCOP;
        c.blocked = true;
        if (!c.blocked_reason || daysOverdue > (c.worst_days || 0)) {
          c.worst_days = daysOverdue;
          c.blocked_reason = `Factura vencida hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''}`;
        }
      }
    }

    let customers = Object.values(byCustomer);

    // Filtros opcionales
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

    const headers = ['Cliente', 'Código', 'Facturas Pend.', 'Total Adeudado', 'Vencido', 'Estado'];
    const rows = customers.map(c => [
      c.customer_name, c.customer_code, c.pending_invoices,
      c.total_adeudado_cop, c.overdue_cop,
      c.blocked ? 'BLOQUEADO' : 'Al día'
    ]);

    const csv = [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clientes-cartera-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
}

module.exports = {
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
