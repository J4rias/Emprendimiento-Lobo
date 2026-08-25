'use strict';

/**
 * Bancos/métodos vistos realmente en los comprobantes capturados por
 * vision-glm/whatsapp-bot (comprobantes.csv, 79 filas al 2026-08-24), para que
 * el cajero pueda seleccionarlos al registrar la referencia de una
 * transferencia. Se excluye Binance/USDT — no usa el selector de banco,
 * tiene su propio payment_method 'usdt'.
 *
 * 'BDV' se renombra a 'Banco de Venezuela' (mismo id, mismas referencias
 * existentes) para que coincida con el nombre que trae el comprobante.
 */

const NUEVOS = [
  { name: 'BBVA Provincial', currency: 'VES', type: 'bank' },
  { name: 'BNC', currency: 'VES', type: 'bank' },
  { name: 'Bancamiga', currency: 'VES', type: 'bank' },
  { name: 'Banco Digital de los Trabajadores', currency: 'VES', type: 'bank' },
  { name: 'BancoFondoComún', currency: 'VES', type: 'bank' },
  { name: 'Banplus', currency: 'VES', type: 'bank' },
  { name: 'Mercantil', currency: 'VES', type: 'bank' },
  { name: 'Nequi', currency: 'COP', type: 'wallet' },
  { name: 'Sofitasa', currency: 'VES', type: 'bank' },
  { name: 'Zelle', currency: 'USD', type: 'other' },
];

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE banks SET name = 'Banco de Venezuela', updated_at = NOW() WHERE name = 'BDV'`
    );

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
      `UPDATE banks SET name = 'BDV', updated_at = NOW() WHERE name = 'Banco de Venezuela'`
    );
    const names = NUEVOS.map((b) => `'${b.name.replace(/'/g, "''")}'`).join(',');
    await queryInterface.sequelize.query(`DELETE FROM banks WHERE name IN (${names})`);
  },
};
