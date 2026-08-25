'use strict';

/**
 * Binance quedó fuera de la migración anterior por error: si el método de
 * pago es 'usdt', el selector de banco no se mostraba en absoluto en el
 * frontend (bug ya corregido). Se agrega aquí junto con un "Otro" por
 * moneda para cuando el banco real no está en la lista — el cajero igual
 * puede escribir el detalle en el campo de referencia.
 */

const NUEVOS = [
  { name: 'Binance', currency: 'USD', type: 'wallet' },
  { name: 'Otro', currency: 'COP', type: 'other' },
  { name: 'Otro', currency: 'USD', type: 'other' },
  { name: 'Otro', currency: 'VES', type: 'other' },
];

module.exports = {
  up: async (queryInterface) => {
    for (const b of NUEVOS) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM banks WHERE name = :name AND currency = :currency LIMIT 1`,
        { replacements: { name: b.name, currency: b.currency } }
      );
      if (existing.length === 0) {
        await queryInterface.sequelize.query(
          `INSERT INTO banks (name, currency, type, is_active, created_at, updated_at)
           VALUES (:name, :currency, :type, 1, NOW(), NOW())`,
          { replacements: b }
        );
      }
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE FROM banks WHERE name = 'Binance' AND currency = 'USD'`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM banks WHERE name = 'Otro' AND currency IN ('COP','USD','VES')`
    );
  },
};
