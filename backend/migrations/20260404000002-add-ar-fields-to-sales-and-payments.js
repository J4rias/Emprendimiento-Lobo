'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const salesTable = await queryInterface.describeTable('sales');
    const paymentsTable = await queryInterface.describeTable('sale_payments');

    // sales.credit_due_date — fecha límite de crédito (24h/48h/72h/168h desde la venta)
    if (!salesTable.credit_due_date) {
      await queryInterface.addColumn('sales', 'credit_due_date', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
        comment: 'Fecha límite de crédito acordada (null = sin término)',
        after: 'sale_type'
      });
    }

    // sale_payments.reversed_at — marca la reversión
    if (!paymentsTable.reversed_at) {
      await queryInterface.addColumn('sale_payments', 'reversed_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
        comment: 'Fecha en que se revirtió el pago (null = vigente)',
        after: 'notes'
      });
    }

    // sale_payments.reversed_by — admin que revirtió
    if (!paymentsTable.reversed_by) {
      await queryInterface.addColumn('sale_payments', 'reversed_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: 'ID del admin que revirtió el pago',
        after: 'reversed_at'
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('sale_payments', 'reversed_by');
    await queryInterface.removeColumn('sale_payments', 'reversed_at');
    await queryInterface.removeColumn('sales', 'credit_due_date');
  }
};
