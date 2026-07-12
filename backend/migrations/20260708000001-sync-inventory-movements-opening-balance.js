'use strict';

/**
 * Data migration — Sincronización de saldo inicial en inventory_movements
 *
 * Raíz del problema:
 *   Los movimientos de egreso (ventas) solo comenzaron a registrarse en
 *   inventory_movements a partir del 24 de junio de 2026, cuando se
 *   implementó la función InventoryMovement.bulkCreate() en sale.service.ts.
 *
 *   Antes de esa fecha, las ventas sí descontaban inventory.quantity (correcto),
 *   pero NO dejaban registro en inventory_movements. Esto causaba que el Kardex
 *   computara un saldo incorrecto al sumar movimientos desde 0.
 *
 * Alcance detectado (2026-07-08):
 *   - 719 productos con diferencia entre inventory.quantity y neto de movimientos
 *   - 33,282 detalles de venta sin movimiento de egreso (134,033 unidades)
 *
 * Corrección:
 *   Por cada producto/almacén con diferencia se inserta UN movimiento de ajuste
 *   fechado el 2026-06-23 23:59:00 (un segundo antes del primer egreso real)
 *   con la cantidad exacta de la diferencia:
 *     - neto_movimientos > inventory.quantity → ajuste_negativo
 *     - neto_movimientos < inventory.quantity → ajuste_positivo
 *
 *   Nota de signos: 'transferencia' persiste quantity CON signo (salida negativa,
 *   entrada positiva), por eso se suma tal cual y no se niega.
 *
 *   Esto hace que el Kardex arranque en el saldo correcto sin alterar
 *   inventory.quantity ni ningún movimiento existente.
 */

const SYNC_DATE = '2026-06-23 23:59:00';
const REASON_NEG = 'Sincronización histórica — ventas anteriores al registro de movimientos';
const REASON_POS = 'Sincronización histórica — movimientos faltantes previos al kardex';

// Neto de movimientos con signo por producto/almacén
const NET_EXPR = `
  COALESCE(SUM(
    CASE
      WHEN im.movement_type IN ('ingreso', 'ajuste_positivo') THEN im.quantity
      WHEN im.movement_type = 'transferencia' THEN im.quantity
      ELSE -im.quantity
    END
  ), 0)
`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // 1. Kardex sobrado (ventas históricas sin egreso) → ajuste_negativo
      await q(`
        INSERT INTO inventory_movements
          (product_id, warehouse_id, movement_type, quantity, loose_units,
           reason, user_id, created_at, updated_at)
        SELECT
          i.product_id,
          i.warehouse_id,
          'ajuste_negativo'                       AS movement_type,
          ROUND(${NET_EXPR} - i.quantity, 2)      AS quantity,
          0                                       AS loose_units,
          '${REASON_NEG}'                         AS reason,
          1                                       AS user_id,
          '${SYNC_DATE}'                          AS created_at,
          NOW()                                   AS updated_at
        FROM inventory i
        LEFT JOIN inventory_movements im
          ON im.product_id = i.product_id
         AND im.warehouse_id = i.warehouse_id
        GROUP BY i.id, i.product_id, i.warehouse_id, i.quantity
        HAVING ROUND(${NET_EXPR} - i.quantity, 4) > 0.01
      `);

      // 2. Kardex corto (stock real mayor que el neto de movimientos) → ajuste_positivo
      await q(`
        INSERT INTO inventory_movements
          (product_id, warehouse_id, movement_type, quantity, loose_units,
           reason, user_id, created_at, updated_at)
        SELECT
          i.product_id,
          i.warehouse_id,
          'ajuste_positivo'                       AS movement_type,
          ROUND(i.quantity - ${NET_EXPR}, 2)      AS quantity,
          0                                       AS loose_units,
          '${REASON_POS}'                         AS reason,
          1                                       AS user_id,
          '${SYNC_DATE}'                          AS created_at,
          NOW()                                   AS updated_at
        FROM inventory i
        LEFT JOIN inventory_movements im
          ON im.product_id = i.product_id
         AND im.warehouse_id = i.warehouse_id
        GROUP BY i.id, i.product_id, i.warehouse_id, i.quantity
        HAVING ROUND(i.quantity - ${NET_EXPR}, 4) > 0.01
      `);
    });
  },

  async down(queryInterface) {
    // Elimina únicamente los movimientos insertados por esta migración
    await queryInterface.sequelize.query(`
      DELETE FROM inventory_movements
      WHERE reason IN ('${REASON_NEG}', '${REASON_POS}')
        AND created_at = '${SYNC_DATE}'
        AND movement_type IN ('ajuste_negativo', 'ajuste_positivo')
    `);
  }
};
