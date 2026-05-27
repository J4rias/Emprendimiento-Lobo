'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('sales');

    if (!table.authorized_by) {
      await queryInterface.addColumn('sales', 'authorized_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'Admin que autorizó la venta a crédito',
        after: 'created_by'
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('sales', 'authorized_by');
  }
};
