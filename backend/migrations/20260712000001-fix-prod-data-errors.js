'use strict';

/**
 * Data migration — Correcciones de errores de datos detectados en la
 * auditoría del 2026-07-12 (replay de datos reales contra el código nuevo).
 *
 * 1. OC-20260307-0001 (JOSE CATIRE COL, id 30) marcada currency='USD' con
 *    montos que son pesos colombianos (proveedor colombiano; costos tipo
 *    33.000/bulto de desinfectante). Contaba 4.573.000 "USD" en el resumen
 *    de cuentas por pagar e inflaba "Bs necesarios" en ~3.300 millones.
 *    → currency='COP' (settlement_currency VES se conserva; la categoría
 *    del ledger para COP no depende del settlement).
 *
 * 2. Nombres con encoding roto (mojibake por doble/triple codificación UTF-8
 *    en la importación original) — 5 filas, corregidas por id con guardas
 *    sobre el valor corrupto exacto:
 *      - suppliers 7  «DOÃƒâ€˜A»  → DOÑA
 *      - suppliers 11 «IBAÃƒâ€˜EZ» → IBAÑEZ
 *      - customers 102 «SeÃƒÂ±or»  → Señor
 *      - customers 128 «NIÃ‘O»     → NIÑO
 *      - products 672  «JabÃ³n»    → Jabón
 *
 * 3. Backfill de 164 movimientos de kardex tipo 'ingreso' sin
 *    document_number/reason: son devoluciones de notas de crédito creadas
 *    antes del fix que registra la referencia (los campos se descartaban).
 *    Se correlacionan por producto + ventana de 5 segundos alrededor del
 *    approved_at de la NC (el movimiento se crea en la misma transacción
 *    que la aprobación). Verificado en la copia de prod: 164/164 matchean.
 *
 * NO se toca NC-20260707-0002 (monedero de 25.000 COP sobre venta luego
 * cancelada): es una decisión comercial con el cliente, no un error técnico.
 */

const MOJIBAKE_FIXES = [
  { table: 'suppliers', id: 7,   col: 'name',      bad: 'DISTRIBUIDORA DOÃƒâ€˜A TERESITA 1983', good: 'DISTRIBUIDORA DOÑA TERESITA 1983' },
  { table: 'suppliers', id: 11,  col: 'name',      bad: 'JOAN IBAÃƒâ€˜EZ',                       good: 'JOAN IBAÑEZ' },
  { table: 'customers', id: 102, col: 'last_name', bad: 'SeÃƒÂ±or',                              good: 'Señor' },
  { table: 'customers', id: 128, col: 'last_name', bad: 'NIÃ‘O',                                 good: 'NIÑO' },
  { table: 'products',  id: 672, col: 'name',      bad: 'JabÃ³n en Barra Las LLaves Fresca Fragancia, 160 gr', good: 'Jabón en Barra Las LLaves Fresca Fragancia, 160 gr' },
];

const BACKFILL_MARKER = 'sincronización histórica NC';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql, replacements) =>
        queryInterface.sequelize.query(sql, { transaction, replacements });

      // 1. OC de JOSE CATIRE: USD → COP
      await q(`
        UPDATE purchase_orders
        SET currency = 'COP'
        WHERE id = 30
          AND order_number = 'OC-20260307-0001'
          AND currency = 'USD'
      `);

      // 2. Nombres con encoding roto
      for (const f of MOJIBAKE_FIXES) {
        await q(
          `UPDATE ${f.table} SET ${f.col} = :good WHERE id = :id AND ${f.col} = BINARY :bad`,
          { good: f.good, id: f.id, bad: f.bad }
        );
      }

      // 3. Backfill de referencias en movimientos de NC históricos
      await q(`
        UPDATE inventory_movements im
        JOIN credit_note_details cnd ON cnd.product_id = im.product_id
        JOIN credit_notes cn ON cn.id = cnd.credit_note_id AND cn.status = 'applied'
        SET im.document_number = cn.credit_note_number,
            im.reason = CONCAT('Devolución de venta — ${BACKFILL_MARKER} ', cn.credit_note_number)
        WHERE im.movement_type = 'ingreso'
          AND im.document_number IS NULL
          AND im.reason IS NULL
          AND ABS(TIMESTAMPDIFF(SECOND, im.created_at, cn.approved_at)) <= 5
      `);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql, replacements) =>
        queryInterface.sequelize.query(sql, { transaction, replacements });

      await q(`
        UPDATE purchase_orders
        SET currency = 'USD'
        WHERE id = 30 AND order_number = 'OC-20260307-0001' AND currency = 'COP'
      `);

      for (const f of MOJIBAKE_FIXES) {
        await q(
          `UPDATE ${f.table} SET ${f.col} = :bad WHERE id = :id AND ${f.col} = BINARY :good`,
          { good: f.good, id: f.id, bad: f.bad }
        );
      }

      await q(`
        UPDATE inventory_movements
        SET document_number = NULL, reason = NULL
        WHERE movement_type = 'ingreso'
          AND reason LIKE '%${BACKFILL_MARKER}%'
      `);
    });
  }
};
