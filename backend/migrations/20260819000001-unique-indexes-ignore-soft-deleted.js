'use strict';

/**
 * Los índices únicos no distinguen filas borradas: tras eliminar una categoría,
 * recrearla con el mismo código daba "duplicado" señalando una fila invisible.
 *
 * Al agregar `deleted_at` al índice el problema desaparece: MySQL considera
 * distintos los NULL, así que conviven una fila viva y N borradas con la misma clave.
 *
 * NO se tocan sales.sale_number, quotes.code ni pre_orders.code: son numeraciones
 * de documento y no deben reutilizarse aunque el documento se anule.
 */

const INDEXES = [
  { table: 'brands',             name: 'name',                          fields: ['name'] },
  { table: 'categories',         name: 'code',                          fields: ['code'] },
  { table: 'customers',          name: 'code',                          fields: ['code'] },
  { table: 'customers',          name: 'document_number',               fields: ['document_number'] },
  { table: 'packaging_types',    name: 'name',                          fields: ['name'] },
  { table: 'presentation_types', name: 'name',                          fields: ['name'] },
  { table: 'price_lists',        name: 'code',                          fields: ['code'] },
  { table: 'products',           name: 'sku',                           fields: ['sku'] },
  { table: 'roles',              name: 'name',                          fields: ['name'] },
  { table: 'users',              name: 'email',                         fields: ['email'] },
  { table: 'users',              name: 'username',                      fields: ['username'] },
  { table: 'exchange_rates',     name: 'unique_exchange_rate_per_day',   fields: ['from_currency', 'to_currency', 'effective_date'] }
];

async function exists(queryInterface, table, name) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    { replacements: [table, name] }
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    for (const { table, name, fields } of INDEXES) {
      if (await exists(queryInterface, table, name)) {
        await queryInterface.removeIndex(table, name);
      }
      await queryInterface.addIndex(table, [...fields, 'deleted_at'], {
        name,
        unique: true
      });
    }
  },

  async down(queryInterface) {
    for (const { table, name, fields } of INDEXES) {
      if (await exists(queryInterface, table, name)) {
        await queryInterface.removeIndex(table, name);
      }
      await queryInterface.addIndex(table, fields, { name, unique: true });
    }
  }
};
