'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('supplier_payments');

    if (!tableDescription.invoice_number) {
      await queryInterface.addColumn('supplier_payments', 'invoice_number', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Número de factura del proveedor asociada al pago',
        after: 'reference'
      });
    }

    if (!tableDescription.status) {
      await queryInterface.addColumn('supplier_payments', 'status', {
        type: Sequelize.ENUM('recorded', 'confirmed', 'cancelled'),
        allowNull: false,
        defaultValue: 'recorded',
        comment: 'Estado del pago',
        after: 'invoice_number'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('supplier_payments', 'invoice_number');
    await queryInterface.removeColumn('supplier_payments', 'status');
  }
};
