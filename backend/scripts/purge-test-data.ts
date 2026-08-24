/**
 * Borra los restos que la suite de tests deja en la base de desarrollo.
 *
 * Los tests corren contra una copia de producción a propósito (probar contra
 * datos reales encuentra cosas que una semilla mínima esconde), pero cada
 * corrida deja unas pocas filas: un usuario, una categoría y una tasa, todas
 * en soft-delete desde que los modelos son paranoid. Son invisibles para la
 * aplicación, así que no molestan — pero se acumulan y ensucian cualquier
 * conteo que uno haga a mano sobre las tablas.
 *
 *   pnpm db:purge-test-data          → solo informa (dry-run)
 *   pnpm db:purge-test-data --apply  → borra de verdad
 *
 * Los patrones son deliberadamente estrechos: si un dato real se llamara
 * parecido, preferimos no tocarlo. Nada aquí borra ventas, clientes ni stock.
 */
import '../models';
const { sequelize } = require('../models');

const APPLY = process.argv.includes('--apply');

type Objetivo = { nombre: string; contar: string; borrar: string[] };

const OBJETIVOS: Objetivo[] = [
  {
    nombre: 'usuarios de prueba (user.test.js)',
    contar: `SELECT COUNT(*) n FROM users
             WHERE username LIKE 'test_user_%' AND email LIKE '%@test.local'`,
    borrar: [`DELETE FROM users WHERE username LIKE 'test_user_%' AND email LIKE '%@test.local'`],
  },
  {
    nombre: 'categorías de prueba (category.test.js)',
    contar: `SELECT COUNT(*) n FROM categories WHERE code = 'TSTCAT' OR name LIKE 'CAT_TEST_%'`,
    borrar: [`DELETE FROM categories WHERE code = 'TSTCAT' OR name LIKE 'CAT_TEST_%'`],
  },
  {
    nombre: 'tasas con fecha 2099 (exchangeRate.test.js)',
    contar: `SELECT COUNT(*) n FROM exchange_rates WHERE effective_date = '2099-01-01'`,
    borrar: [`DELETE FROM exchange_rates WHERE effective_date = '2099-01-01'`],
  },
  {
    nombre: 'marcas de prueba (softDelete.test.js)',
    contar: `SELECT COUNT(*) n FROM brands WHERE name LIKE '__test_soft_delete_%'`,
    borrar: [`DELETE FROM brands WHERE name LIKE '__test_soft_delete_%'`],
  },
  {
    nombre: 'proveedores de prueba y sus OC (compras.flow.test.js)',
    contar: `SELECT COUNT(*) n FROM suppliers WHERE name LIKE 'TEST Compras %' OR name LIKE 'PROBE%'`,
    borrar: [
      `DELETE FROM supplier_payment_allocations WHERE payment_id IN (
         SELECT id FROM supplier_payments WHERE supplier_id IN (
           SELECT id FROM suppliers WHERE name LIKE 'TEST Compras %' OR name LIKE 'PROBE%'))`,
      `DELETE FROM supplier_payments WHERE supplier_id IN (
         SELECT id FROM suppliers WHERE name LIKE 'TEST Compras %' OR name LIKE 'PROBE%')`,
      `DELETE FROM purchase_order_details WHERE purchase_order_id IN (
         SELECT id FROM purchase_orders WHERE supplier_id IN (
           SELECT id FROM suppliers WHERE name LIKE 'TEST Compras %' OR name LIKE 'PROBE%'))`,
      `DELETE FROM purchase_orders WHERE supplier_id IN (
         SELECT id FROM suppliers WHERE name LIKE 'TEST Compras %' OR name LIKE 'PROBE%')`,
      `DELETE FROM suppliers WHERE name LIKE 'TEST Compras %' OR name LIKE 'PROBE%'`,
    ],
  },
  {
    nombre: 'movimientos de kardex de prueba',
    contar: `SELECT COUNT(*) n FROM inventory_movements
             WHERE document_number LIKE 'F-TEST-COMPRAS-%' OR document_number = 'F-PRUEBA-COSTO-CERO'`,
    borrar: [`DELETE FROM inventory_movements
              WHERE document_number LIKE 'F-TEST-COMPRAS-%' OR document_number = 'F-PRUEBA-COSTO-CERO'`],
  },
];

(async () => {
  console.log(APPLY ? '── PURGA (se van a borrar filas) ──\n' : '── DRY RUN (no se borra nada; usa --apply) ──\n');

  let total = 0;
  for (const o of OBJETIVOS) {
    const [rows]: any = await sequelize.query(o.contar);
    const n = Number(rows[0].n);
    total += n;
    if (n === 0) { console.log(`  ·  ${o.nombre}: limpio`); continue; }

    if (APPLY) {
      for (const sql of o.borrar) await sequelize.query(sql);
      console.log(`  ✔  ${o.nombre}: ${n} borradas`);
    } else {
      console.log(`  →  ${o.nombre}: ${n} por borrar`);
    }
  }

  console.log(`\n${total} filas ${APPLY ? 'eliminadas' : 'pendientes'}.`);
  if (!APPLY && total > 0) console.log('Corre con --apply para borrarlas.');

  await sequelize.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
