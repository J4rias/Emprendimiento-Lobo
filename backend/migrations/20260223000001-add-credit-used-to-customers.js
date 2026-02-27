'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('customers');
    if (!tableDescription.credit_used) {
      await queryInterface.addColumn('customers', 'credit_used', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Crédito actualmente usado por el cliente',
        after: 'credit_limit'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('customers', 'credit_used');
  }
};
