/* eslint-disable no-unused-vars */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Índice para búsquedas de ventas por customer_id (muy usado en AR)
      await queryInterface.addIndex(
        'sales',
        ['customer_id'],
        {
          name: 'idx_sales_customer_id',
          transaction,
        }
      );

      // Índice para búsquedas de SalePayment por sale_id (relationship lookup)
      await queryInterface.addIndex(
        'sale_payments',
        ['sale_id'],
        {
          name: 'idx_sale_payments_sale_id',
          transaction,
        }
      );

      // Índice compuesto para filtrado de ventas activas a crédito (combinación frecuente)
      await queryInterface.addIndex(
        'sales',
        ['customer_id', 'sale_type', 'status'],
        {
          name: 'idx_sales_customer_type_status',
          transaction,
        }
      );

      // Índice para reversal checks (WHERE payment_method = 'credit_balance' AND reversed_at IS NULL)
      await queryInterface.addIndex(
        'sale_payments',
        ['payment_method', 'reversed_at'],
        {
          name: 'idx_sale_payments_method_reversed',
          transaction,
        }
      );

      await transaction.commit();
      console.log('✓ Índices de performance agregados a sales y sale_payments');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex('sales', 'idx_sales_customer_id', { transaction });
      await queryInterface.removeIndex('sale_payments', 'idx_sale_payments_sale_id', { transaction });
      await queryInterface.removeIndex('sales', 'idx_sales_customer_type_status', { transaction });
      await queryInterface.removeIndex('sale_payments', 'idx_sale_payments_method_reversed', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
