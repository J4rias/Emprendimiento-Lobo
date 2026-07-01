'use strict';

/**
 * Data migration — BUG-021: credit_amount no se reducía al registrar abonos
 *
 * Raíz del bug: `addPayment` actualizaba `paid_amount` pero nunca reducía
 * `credit_amount`. Tras cada abono la venta quedaba con:
 *   paid_amount = total  ✓
 *   credit_amount = total ✗  (debería ser 0 si está completamente pagada)
 *
 * Alcance detectado (2026-06-30):
 *   - 668 ventas con credit_amount inflado  (+$466,517 USD en cartera fantasma)
 *   -   4 ventas con credit_amount deflado  (saldo pendiente oculto)
 *   - credit_used de clientes desincronizado como consecuencia
 *
 * Pasos:
 *   1. Corregir credit_amount en todas las ventas afectadas:
 *      credit_amount = GREATEST(0, total - paid_amount)
 *   2. Recalcular credit_used de cada cliente como la suma real
 *      de credit_amount en sus ventas activas pendientes.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // 1. Corregir credit_amount en todas las ventas de crédito/mixtas
      //    donde el valor actual difiere de (total - paid_amount) en más de $0.01
      await q(`
        UPDATE sales
        SET credit_amount = GREATEST(0, total - paid_amount)
        WHERE sale_type IN ('credit', 'mixed')
          AND status != 'cancelled'
          AND deleted_at IS NULL
          AND ABS(credit_amount - GREATEST(0, total - paid_amount)) > 0.01
      `);

      // 2. Recalcular credit_used de cada cliente:
      //    = suma de credit_amount de sus ventas pendientes no canceladas
      //    Para clientes sin ventas pendientes, queda en 0.
      await q(`
        UPDATE customers c
        LEFT JOIN (
          SELECT customer_id,
                 COALESCE(SUM(credit_amount), 0) AS credit_pendiente
          FROM sales
          WHERE sale_type IN ('credit', 'mixed')
            AND status = 'pending'
            AND deleted_at IS NULL
          GROUP BY customer_id
        ) agg ON agg.customer_id = c.id
        SET c.credit_used = COALESCE(agg.credit_pendiente, 0)
        WHERE c.id IN (
          SELECT DISTINCT customer_id
          FROM sales
          WHERE sale_type IN ('credit', 'mixed')
            AND deleted_at IS NULL
            AND customer_id IS NOT NULL
        )
      `);
    });
  },

  async down() {
    // No reversible: esta migración corrige datos erróneos.
    // Para revertir se necesitaría un backup previo a 2026-06-30.
  }
};
