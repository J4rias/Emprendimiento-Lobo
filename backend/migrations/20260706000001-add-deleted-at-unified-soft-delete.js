'use strict';

const TABLES = [
  'brands', 'products', 'suppliers', 'packaging_types', 'presentation_types',
  'categories', 'users', 'roles', 'exchange_rates', 'customers', 'quotes', 'price_lists'
];

const SOFT_DELETE_TABLES = ['customers', 'quotes', 'price_lists'];

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add deleted_at column to all target tables
    for (const table of TABLES) {
      await queryInterface.addColumn(table, 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
        after: 'updated_at'
      });
    }

    // 2. Migrate existing manual soft-deletes: is_deleted=1 → deleted_at = NOW()
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    for (const table of SOFT_DELETE_TABLES) {
      await queryInterface.sequelize.query(
        `UPDATE \`${table}\` SET deleted_at = '${now}' WHERE is_deleted = 1 AND deleted_at IS NULL`
      );
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      await queryInterface.removeColumn(table, 'deleted_at');
    }
  }
};
