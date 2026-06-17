'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('purchase_orders', 'settlement_currency', {
      type: Sequelize.ENUM('USD', 'VES', 'COP'),
      allowNull: false,
      defaultValue: 'VES',
      after: 'currency',
      comment: 'Moneda en que se paga: VES=bolívares (cat. USD), USD=divisas/Zelle (cat. DIVISAS), COP=pesos (cat. COP)'
    });

    // Set defaults for existing POs based on their invoice currency
    await queryInterface.sequelize.query(
      `UPDATE purchase_orders SET settlement_currency = 'COP' WHERE currency = 'COP'`
    );
    await queryInterface.sequelize.query(
      `UPDATE purchase_orders SET settlement_currency = 'VES' WHERE currency = 'VES'`
    );
    // USD POs default to VES settlement (most common case)
    // Users can change to USD (DIVISAS) when needed
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('purchase_orders', 'settlement_currency');
    // Clean up ENUM type if needed (MySQL handles this automatically)
  }
};
