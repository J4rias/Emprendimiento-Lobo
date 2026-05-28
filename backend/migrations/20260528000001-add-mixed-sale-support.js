'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sales', 'sale_type', {
      type: Sequelize.ENUM('cash', 'credit', 'mixed'),
      allowNull: false,
      defaultValue: 'cash'
    });

    await queryInterface.addColumn('sales', 'credit_amount', {
      type: Sequelize.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 0.00,
      after: 'total',
      comment: 'Monto a crédito (para ventas mixtas)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('sales', 'credit_amount');

    await queryInterface.changeColumn('sales', 'sale_type', {
      type: Sequelize.ENUM('cash', 'credit'),
      allowNull: false,
      defaultValue: 'cash'
    });
  }
};
