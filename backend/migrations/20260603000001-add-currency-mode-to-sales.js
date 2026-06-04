'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('sales');
    if (!table.currency_mode) {
      await queryInterface.addColumn('sales', 'currency_mode', {
        type: Sequelize.ENUM('USD', 'COP'),
        allowNull: false,
        defaultValue: 'COP',
        after: 'sale_type',
        comment: 'Modo de moneda activo en el POS al momento de la venta'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('sales');
    if (table.currency_mode) {
      await queryInterface.removeColumn('sales', 'currency_mode');
    }
  }
};
