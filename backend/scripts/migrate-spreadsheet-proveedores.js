/**
 * Migration script v2: Import supplier invoices & payments from spreadsheet CSVs
 *
 * Reads CSV files exported from Google Sheets (~/tmp/proveedores/)
 * - Cancels pre-existing POs for suppliers that appear in the spreadsheet
 * - Creates PurchaseOrders for each invoice line
 * - Creates SupplierPayments for each payment line
 * - Handles RESUMEN-only suppliers (balance snapshots)
 * - Generates proveedores-pendientes.csv for manually completing supplier info
 *
 * Usage:
 *   node scripts/migrate-spreadsheet-proveedores.js           # DRY RUN (default)
 *   node scripts/migrate-spreadsheet-proveedores.js --execute  # Actually insert data
 */

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const db = require('../models');

const DRY_RUN = !process.argv.includes('--execute');
const CSV_DIR = path.join(process.env.HOME, 'tmp/proveedores');

// ── Spanish month maps ──
const MONTH_FULL = {
  'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
  'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
};
const MONTH_SHORT = {
  'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
  'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
};

// ══════════════════════════════════════════════════════
// CSV FILE → SUPPLIER MAPPING
// Each entry: { file, supplierId (existing) OR supplierName (create) }
// Multi-sheet suppliers appear multiple times with same ID.
// ══════════════════════════════════════════════════════
const CSV_FILES = [
  // ── Multi-sheet suppliers ──
  // Herdanis: old sheet (Feb-May) + new sheet (May+), both USD category, supplier id=6
  { file: '[PROVEEDORES] RELACION  - Herdanis.csv', supplierId: 6, forceCat: 'USD' },
  { file: '[PROVEEDORES] RELACION  - Distribuidora Herdanis.csv', supplierId: 6 },
  // DHL: BSS (USD cat) + USD (DIVISAS cat), supplier id=9
  { file: '[PROVEEDORES] RELACION  - Corporación DHL BSS.csv', supplierId: 9 },
  { file: '[PROVEEDORES] RELACION  - Corporación DHL USD.csv', supplierId: 9 },
  // Grupo Don Bodegón: BSS + COP
  { file: '[PROVEEDORES] RELACION  - Grupo Don Bodegón BSS.csv', supplierName: 'GRUPO DON BODEGON' },
  { file: '[PROVEEDORES] RELACION  - Grupo Don Bodegón COP.csv', supplierName: 'GRUPO DON BODEGON' },
  // Principal: BSS + USD
  { file: '[PROVEEDORES] RELACION  - Principal BSS.csv', supplierName: 'PRINCIPAL' },
  { file: '[PROVEEDORES] RELACION  - Principal USD.csv', supplierName: 'PRINCIPAL' },

  // ── Single-sheet suppliers with existing DB IDs ──
  { file: '[PROVEEDORES] RELACION  - Campesino.csv', supplierId: 17 },
  { file: '[PROVEEDORES] RELACION  - Chispa.csv', supplierId: 10 },
  { file: '[PROVEEDORES] RELACION  - Excelsior Distribuciones RK (Eliany Martinez).csv', supplierId: 16 },
  { file: '[PROVEEDORES] RELACION  - Servicios Gualmatt BSS.csv', supplierId: 24 },
  { file: '[PROVEEDORES] RELACION  - Daniela Productos Colombianos.csv', supplierId: 19 },
  { file: '[PROVEEDORES] RELACION  - Bebidas Colombianas (Jean Franco).csv', supplierId: 13 },

  // ── Single-sheet suppliers to create ──
  { file: '[PROVEEDORES] RELACION  - Alimentos Polar.csv', supplierName: 'ALIMENTOS POLAR' },
  { file: '[PROVEEDORES] RELACION  - Azucar La Dulzura.csv', supplierName: 'AZUCAR LA DULZURA' },
  { file: '[PROVEEDORES] RELACION  - Cafe Cende.csv', supplierName: 'CAFE CENDE' },
  { file: '[PROVEEDORES] RELACION  - Cafe Fruto Santo.csv', supplierName: 'CAFE FRUTO SANTO' },
  { file: '[PROVEEDORES] RELACION  - Cafe Nasif.csv', supplierName: 'CAFE NASIF' },
  { file: '[PROVEEDORES] RELACION  - Cafe Turpial.csv', supplierName: 'CAFE TURPIAL' },
  { file: '[PROVEEDORES] RELACION  - Chimo Apureñito.csv', supplierName: 'CHIMO APUREÑITO' },
  { file: '[PROVEEDORES] RELACION  - Coca Cola.csv', supplierName: 'COCA COLA' },
  { file: '[PROVEEDORES] RELACION  - Diprotachira.csv', supplierName: 'DIPROTACHIRA' },
  { file: '[PROVEEDORES] RELACION  - Disancha .csv', supplierName: 'DISANCHA' },
  { file: '[PROVEEDORES] RELACION  - Dovenca.csv', supplierName: 'DOVENCA' },
  { file: '[PROVEEDORES] RELACION  - Engozmar.csv', supplierName: 'ENGOZMAR' },
  { file: '[PROVEEDORES] RELACION  - Galletas de Coco.csv', supplierName: 'GALLETAS DE COCO' },
  { file: '[PROVEEDORES] RELACION  - Inversiones JOL.csv', supplierName: 'INVERSIONES JOL' },
  { file: '[PROVEEDORES] RELACION  - ITC Distribuciones Los Llanos.csv', supplierName: 'ITC DISTRIBUCIONES LOS LLANOS' },
  { file: '[PROVEEDORES] RELACION  - Maria Puig.csv', supplierName: 'MARIA PUIG' },
  { file: '[PROVEEDORES] RELACION  - Masia.csv', supplierName: 'MASIA' },
  { file: '[PROVEEDORES] RELACION  - Monaca.csv', supplierName: 'MONACA' },
  { file: '[PROVEEDORES] RELACION  - Rolando.csv', supplierName: 'ROLANDO' },
  { file: '[PROVEEDORES] RELACION  - Tigo.csv', supplierName: 'TIGO' },
  { file: '[PROVEEDORES] RELACION  - Viracas.csv', supplierName: 'VIRACAS' },
  { file: '[PROVEEDORES] RELACION  - Aliados Villamizar.csv', supplierName: 'ALIADOS VILLAMIZAR' },
  // Leonardo Hijo: CSV has non-standard format, handled in RESUMEN_ONLY
  { file: '[PROVEEDORES] RELACION  - Pintupro .csv', supplierName: 'PINTUPRO' },
];

// Suppliers only in RESUMEN (no CSV) — balance-only POs
const RESUMEN_ONLY = [
  { supplierId: 4, category: 'COP', balance: 22400000, currency: 'COP', settlement: 'COP' },      // LAS MERCEDES COP
  { supplierId: 3, category: 'USD', balance: 3204.21, currency: 'USD', settlement: 'VES' },        // LAS MERCEDES BSS
  { supplierName: 'WISTON TRUJILLANA', category: 'COP', balance: 8129000, currency: 'COP', settlement: 'COP' },
  { supplierName: 'MIMESA USD', category: 'DIVISAS', balance: 29175.28, currency: 'USD', settlement: 'USD' },
  { supplierName: 'MIMESA BSS', category: 'USD', balance: 855.04, currency: 'USD', settlement: 'VES' },
  { supplierName: 'COMBI', category: 'DIVISAS', balance: 500, currency: 'USD', settlement: 'USD' },
  { supplierName: 'LEONARDO HIJO', category: 'COP', balance: 3537400, currency: 'COP', settlement: 'COP' },
];

// ══════════════════════════════════════════════════════
// PARSING HELPERS
// ══════════════════════════════════════════════════════

function parseSpanishNum(str) {
  if (!str || typeof str !== 'string') return 0;
  let s = str.replace(/[$BsFbf\s"]/gi, '').trim();
  if (!s || s === '-') return 0;
  const negative = s.startsWith('-');
  if (negative) s = s.slice(1).trim();
  s = s.replace(/\./g, '').replace(',', '.');
  const val = parseFloat(s);
  if (isNaN(val)) return 0;
  return negative ? -val : val;
}

// Invoice dates: "22 mayo, 2026"
function parseInvoiceDate(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.replace(/"/g, '').trim();
  const m = s.match(/^(\d{1,2})\s+(\w+),?\s*(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1]);
  const monthName = m[2].toLowerCase();
  const year = parseInt(m[3]);
  const month = MONTH_FULL[monthName];
  if (month === undefined) return null;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Payment dates: "sáb, may 23, 2026"
function parsePaymentDate(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.replace(/"/g, '').trim();
  const m = s.match(/^.+?,\s+(\w+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (!m) return null;
  const monthName = m[1].toLowerCase();
  const day = parseInt(m[2]);
  const year = parseInt(m[3]);
  const month = MONTH_SHORT[monthName];
  if (month === undefined) return null;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  fields.push(current.trim());
  return fields;
}

function detectCategory(firstLine) {
  const fields = parseCSVLine(firstLine);
  const cat = (fields[0] || '').toUpperCase().trim();
  if (['USD', 'DIVISAS', 'COP'].includes(cat)) return cat;
  return null; // Unknown
}

function categoryToSettlement(category) {
  if (category === 'COP') return 'COP';
  if (category === 'DIVISAS') return 'USD';
  return 'VES';
}

function categoryToCurrency(category) {
  if (category === 'COP') return 'COP';
  return 'USD';
}

// ── Parse a supplier CSV ──
function parseSupplierCSV(filePath, forceCat) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.replace(/\r$/, ''));

  const category = forceCat || detectCategory(lines[0]);
  if (!category) {
    return { category: null, invoices: [], payments: [] };
  }

  const invoices = [];
  const payments = [];
  let lastInvDate = null;
  let lastPayDate = null;

  for (let i = 5; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);

    if ((fields[0] || '').toUpperCase() === 'TOTAL' || (fields[3] || '').toUpperCase() === 'TOTAL') {
      break;
    }

    // LEFT SIDE: Invoice (cols 0-2)
    const invDateStr = fields[0] || '';
    const invDesc = fields[1] || '';
    const invAmount = parseSpanishNum(fields[2]);

    if (invAmount !== 0 || (invDateStr && invDesc)) {
      const invDate = parseInvoiceDate(invDateStr) || lastInvDate;
      if (invDate && invAmount !== 0) {
        invoices.push({ date: invDate, description: invDesc || 'Factura', amount: invAmount });
      }
      if (parseInvoiceDate(invDateStr)) lastInvDate = parseInvoiceDate(invDateStr);
    }

    // RIGHT SIDE: Payment (cols 3-7)
    const payDateStr = fields[3] || '';
    const payDesc = fields[4] || '';
    const payBCV = parseSpanishNum(fields[5]);
    const payCol6 = parseSpanishNum(fields[6]); // VES amount (USD cat) or COP/USD
    const payCol7 = parseSpanishNum(fields[7]); // TOTAL in target currency

    if (payCol7 !== 0 || payCol6 !== 0) {
      const parsedPayDate = parsePaymentDate(payDateStr);
      const payDate = parsedPayDate || lastPayDate || lastInvDate; // fallback to invoice date
      if (payDate) {
        payments.push({
          date: payDate,
          description: payDesc || 'Pago',
          bcv_rate: payBCV || null,
          amount_col6: payCol6 || null,  // VES for USD cat
          amount_col7: payCol7 || null,  // TOTAL in target currency
        });
      }
      if (parsedPayDate) lastPayDate = parsedPayDate;
    }
  }

  return { category, invoices, payments };
}

// ══════════════════════════════════════════════════════
// MAIN MIGRATION
// ══════════════════════════════════════════════════════
async function migrate() {
  console.log(DRY_RUN ? '=== DRY RUN MODE ===' : '=== EXECUTING MIGRATION ===\n');

  const CREATED_BY = 1;
  const WAREHOUSE_ID = 1;
  let poCounter = 900000;
  let payCounter = 900000;

  const stats = { suppliers_created: 0, suppliers_matched: 0, pos_created: 0, payments_created: 0, pos_cancelled: 0, errors: [] };
  const supplierCache = {}; // name → id (avoid duplicate creation)
  const newSuppliers = []; // Track new suppliers for CSV export

  // ── Helper: get or create supplier ──
  async function getOrCreateSupplier(supplierId, supplierName) {
    if (supplierId) {
      const s = await db.Supplier.findByPk(supplierId);
      if (s) {
        stats.suppliers_matched++;
        return s.id;
      }
      stats.errors.push(`Supplier ID ${supplierId} not found!`);
      return null;
    }
    if (!supplierName) {
      stats.errors.push('No supplier ID or name provided');
      return null;
    }
    // Check cache first
    if (supplierCache[supplierName]) return supplierCache[supplierName];

    // Check if already exists by exact name
    let existing = await db.Supplier.findOne({ where: { name: supplierName } });
    if (existing) {
      supplierCache[supplierName] = existing.id;
      stats.suppliers_matched++;
      return existing.id;
    }
    // Check case-insensitive
    existing = await db.Supplier.findOne({
      where: db.sequelize.where(
        db.sequelize.fn('UPPER', db.sequelize.col('name')),
        supplierName.toUpperCase()
      )
    });
    if (existing) {
      supplierCache[supplierName] = existing.id;
      stats.suppliers_matched++;
      return existing.id;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] Would create supplier: ${supplierName}`);
      stats.suppliers_created++;
      supplierCache[supplierName] = -stats.suppliers_created;
      newSuppliers.push({ name: supplierName, id: null });
      return supplierCache[supplierName];
    }

    const created = await db.Supplier.create({
      name: supplierName, contact_name: '', phone: '', is_active: true, created_by: CREATED_BY
    });
    console.log(`  Created supplier: ${supplierName} (id: ${created.id})`);
    supplierCache[supplierName] = created.id;
    stats.suppliers_created++;
    newSuppliers.push({ name: supplierName, id: created.id });
    return created.id;
  }

  // ── Helper: cancel pre-existing POs for a supplier ──
  async function cancelPreExistingPOs(supplierId) {
    if (supplierId < 0) return; // placeholder in dry run
    const existing = await db.PurchaseOrder.findAll({
      where: {
        supplier_id: supplierId,
        order_number: { [Op.notLike]: 'MIG-%' },
        status: { [Op.notIn]: ['cancelled'] }
      }
    });
    if (existing.length === 0) return;

    for (const po of existing) {
      if (DRY_RUN) {
        console.log(`  [DRY] Would cancel: ${po.order_number} ($${parseFloat(po.total).toFixed(2)} ${po.currency})`);
      } else {
        await po.update({
          status: 'cancelled',
          notes: (po.notes || '') + ' | Cancelada: reemplazada por migración spreadsheet v2'
        });
        console.log(`  CANCELLED: ${po.order_number} ($${parseFloat(po.total).toFixed(2)} ${po.currency})`);
      }
      stats.pos_cancelled++;
    }
  }

  // ── Helper: create PO ──
  async function createPO(supplierId, date, description, amount, currency, settlementCurrency) {
    poCounter++;
    const orderNumber = `MIG-${String(poCounter).padStart(6, '0')}`;
    if (!DRY_RUN) {
      await db.PurchaseOrder.create({
        order_number: orderNumber, supplier_id: supplierId, warehouse_id: WAREHOUSE_ID,
        order_date: date, status: 'received', currency, settlement_currency: settlementCurrency,
        subtotal: amount, tax_amount: 0, discount_amount: 0, total: amount,
        notes: `Migrado de spreadsheet: ${description}`, created_by: CREATED_BY
      });
    }
    stats.pos_created++;
    return orderNumber;
  }

  // ── Helper: create Payment ──
  async function createPayment(supplierId, date, description, amount, currency, exchangeRate) {
    payCounter++;
    const paymentNumber = `MIG-${String(payCounter).padStart(6, '0')}`;
    if (!DRY_RUN) {
      await db.SupplierPayment.create({
        payment_number: paymentNumber, supplier_id: supplierId,
        payment_date: date, payment_method: 'transfer',
        amount, currency, reference: description, status: 'confirmed',
        notes: 'Migrado de spreadsheet', created_by: CREATED_BY,
        exchange_rate: exchangeRate || null,
        exchange_rate_from: exchangeRate ? 'USD' : null,
        exchange_rate_to: exchangeRate ? 'VES' : null
      });
    }
    stats.payments_created++;
    return paymentNumber;
  }

  // ══════════════════════════════════════════════
  // PART 1: Process CSV files
  // ══════════════════════════════════════════════
  console.log('═══ PART 1: CSV files ═══\n');

  const processedSupplierIds = new Set();

  for (const csvDef of CSV_FILES) {
    const filePath = path.join(CSV_DIR, csvDef.file);
    if (!fs.existsSync(filePath)) {
      stats.errors.push(`File not found: ${csvDef.file}`);
      console.log(`  SKIP: ${csvDef.file} (not found)`);
      continue;
    }

    const shortName = csvDef.file.replace('[PROVEEDORES] RELACION  - ', '').replace('.csv', '');
    console.log(`── ${shortName}`);

    const { category, invoices, payments } = parseSupplierCSV(filePath, csvDef.forceCat);

    if (!category) {
      console.log(`   SKIP: no category detected`);
      stats.errors.push(`No category: ${csvDef.file}`);
      continue;
    }

    const currency = categoryToCurrency(category);
    const settlement = categoryToSettlement(category);

    console.log(`   Cat: ${category} | Cur: ${currency} | Sett: ${settlement} | Inv: ${invoices.length} | Pay: ${payments.length}`);

    const supplierId = await getOrCreateSupplier(csvDef.supplierId, csvDef.supplierName);
    if (!supplierId) continue;

    // Cancel pre-existing POs (only once per supplier)
    if (!processedSupplierIds.has(supplierId)) {
      await cancelPreExistingPOs(supplierId);
      processedSupplierIds.add(supplierId);
    }

    // Create POs for invoices (negative amounts = credit notes)
    let totalInvoiced = 0;
    for (const inv of invoices) {
      if (inv.amount === 0) continue;
      await createPO(supplierId, inv.date, inv.description, inv.amount, currency, settlement);
      totalInvoiced += inv.amount;
    }

    // Create Payments
    let totalPaid = 0;
    for (const pay of payments) {
      let payAmount, payCurrency, payRate;

      if (category === 'USD') {
        // Payments in VES with BCV rate
        if (pay.amount_col6 && pay.bcv_rate) {
          payAmount = pay.amount_col6;
          payCurrency = 'VES';
          payRate = pay.bcv_rate;
          totalPaid += pay.amount_col7 || (pay.amount_col6 / pay.bcv_rate);
        } else if (pay.amount_col7) {
          // No VES amount - try to find nearby rate for VES conversion
          const idx = payments.indexOf(pay);
          let nearbyRate = null;
          for (let off = 1; off < payments.length; off++) {
            if (idx + off < payments.length && payments[idx + off].bcv_rate) { nearbyRate = payments[idx + off].bcv_rate; break; }
            if (idx - off >= 0 && payments[idx - off].bcv_rate) { nearbyRate = payments[idx - off].bcv_rate; break; }
          }
          if (nearbyRate) {
            payAmount = Math.round(pay.amount_col7 * nearbyRate * 100) / 100;
            payCurrency = 'VES';
            payRate = nearbyRate;
            totalPaid += pay.amount_col7;
          } else {
            // No nearby rate at all (e.g., Zelle payments) - store as USD directly
            payAmount = pay.amount_col7;
            payCurrency = 'USD';
            payRate = null;
            totalPaid += pay.amount_col7;
          }
        } else {
          continue;
        }
      } else if (category === 'DIVISAS') {
        // Payments in USD directly
        payAmount = pay.amount_col7 || pay.amount_col6 || 0;
        payCurrency = 'USD';
        payRate = null;
        totalPaid += payAmount;
      } else if (category === 'COP') {
        // Payments in COP - use TOTAL column (col7) which is always in COP
        payAmount = pay.amount_col7 || pay.amount_col6 || 0;
        payCurrency = 'COP';
        payRate = null;
        totalPaid += payAmount;
      }

      if (payAmount && Math.abs(payAmount) > 0.001) {
        await createPayment(supplierId, pay.date, pay.description, Math.abs(payAmount), payCurrency, payRate);
      }
    }

    const balance = totalInvoiced - totalPaid;
    console.log(`   Inv: ${totalInvoiced.toFixed(2)} | Paid: ${totalPaid.toFixed(2)} | Bal: ${balance.toFixed(2)}`);
    console.log('');
  }

  // ══════════════════════════════════════════════
  // PART 2: RESUMEN-only suppliers (balance POs)
  // ══════════════════════════════════════════════
  console.log('═══ PART 2: RESUMEN-only suppliers ═══\n');

  for (const entry of RESUMEN_ONLY) {
    if (Math.abs(entry.balance) < 0.01) continue;

    const supplierId = await getOrCreateSupplier(entry.supplierId, entry.supplierName);
    if (!supplierId) continue;

    // Cancel pre-existing POs
    if (!processedSupplierIds.has(supplierId)) {
      await cancelPreExistingPOs(supplierId);
      processedSupplierIds.add(supplierId);
    }

    const displayName = entry.supplierName || `Supplier #${entry.supplierId}`;
    console.log(`  ${displayName}: ${entry.currency} ${entry.balance.toLocaleString('es-ES')}`);

    await createPO(supplierId, '2026-06-16', 'Saldo pendiente (migración)', entry.balance, entry.currency, entry.settlement);
    console.log('');
  }

  // ══════════════════════════════════════════════
  // PART 3: Generate supplier info CSV
  // ══════════════════════════════════════════════
  console.log('═══ PART 3: Generating proveedores-pendientes.csv ═══\n');

  // Get all suppliers that were used in the migration
  const allSupplierIds = [...processedSupplierIds].filter(id => id > 0);
  const csvRows = ['ID,NOMBRE,RIF/NIT,CONDICIONES_PAGO,NOTAS'];

  for (const sid of allSupplierIds.sort((a, b) => a - b)) {
    const s = await db.Supplier.findByPk(sid, { attributes: ['id', 'name', 'tax_id', 'payment_terms', 'notes'] });
    if (!s) continue;
    const row = [
      s.id,
      `"${s.name}"`,
      `"${s.tax_id || ''}"`,
      `"${s.payment_terms || ''}"`,
      `"${(s.notes || '').replace(/"/g, '""')}"`,
    ].join(',');
    csvRows.push(row);
  }

  // Also add new suppliers that were created
  for (const ns of newSuppliers) {
    if (ns.id && allSupplierIds.includes(ns.id)) continue;
    csvRows.push(`${ns.id || '?'},"${ns.name}","","",""`);
  }

  const csvPath = path.join(CSV_DIR, 'proveedores-pendientes.csv');
  if (!DRY_RUN) {
    fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
    console.log(`  Written: ${csvPath} (${csvRows.length - 1} suppliers)`);
  } else {
    console.log(`  [DRY] Would write ${csvRows.length - 1} suppliers to ${csvPath}`);
  }

  // ══════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════
  console.log('\n═══ SUMMARY ═══');
  console.log(`Suppliers matched: ${stats.suppliers_matched}`);
  console.log(`Suppliers created: ${stats.suppliers_created}`);
  console.log(`POs cancelled (pre-existing): ${stats.pos_cancelled}`);
  console.log(`POs created: ${stats.pos_created}`);
  console.log(`Payments created: ${stats.payments_created}`);
  if (stats.errors.length > 0) {
    console.log(`\nERRORS (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`  ✗ ${e}`));
  }
  if (DRY_RUN) {
    console.log('\n⚠ DRY RUN - No data was modified. Run with --execute to apply.');
  } else {
    console.log('\n✓ Migration complete!');
  }
}

migrate()
  .catch(err => { console.error('Migration failed:', err); process.exit(1); })
  .finally(() => process.exit());
