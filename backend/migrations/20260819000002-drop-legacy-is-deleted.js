'use strict';

/**
 * Elimina la bandera legacy `is_deleted`, reemplazada por `deleted_at` en la
 * migración 20260706000001 y ya sin lectores en el código (2026-08-19).
 *
 * Tener dos fuentes de verdad para lo mismo era el riesgo: `.destroy()` solo
 * escribe `deleted_at`, así que cualquier consulta que siguiera mirando
 * `is_deleted` habría mostrado registros borrados como si estuvieran vivos.
 *
 * La migración aborta si encuentra una fila con is_deleted=1 y deleted_at NULL:
 * eso significaría que el backfill de 20260706000001 no se completó.
 */

const TABLES = ['customers', 'price_lists', 'quotes'];

async function hasColumn(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'is_deleted' LIMIT 1`,
    { replacements: [table] }
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    for (const table of TABLES) {
      if (!await hasColumn(queryInterface, table)) continue;

      const [[{ pendientes }]] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS pendientes FROM \`${table}\`
         WHERE is_deleted = 1 AND deleted_at IS NULL`
      );
      if (Number(pendientes) > 0) {
        throw new Error(
          `${table}: ${pendientes} filas con is_deleted=1 y deleted_at NULL. ` +
          `Corre primero el backfill de 20260706000001; abortando para no perder el marcado.`
        );
      }

      await queryInterface.removeColumn(table, 'is_deleted');
    }
  },

  async down(queryInterface, Sequelize) {
    for (const table of TABLES) {
      if (await hasColumn(queryInterface, table)) continue;

      await queryInterface.addColumn(table, 'is_deleted', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      await queryInterface.sequelize.query(
        `UPDATE \`${table}\` SET is_deleted = 1 WHERE deleted_at IS NOT NULL`
      );
    }
  }
};
