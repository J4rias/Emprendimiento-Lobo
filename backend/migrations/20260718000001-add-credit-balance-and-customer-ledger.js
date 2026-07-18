'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add credit_balance to customers
    const tableDesc = await queryInterface.describeTable('customers');
    if (!tableDesc.credit_balance) {
      await queryInterface.addColumn('customers', 'credit_balance', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        after: 'credit_used',
        comment: 'Saldo a favor del cliente (sobrepagos, notas de crédito) en USD'
      });
    }

    // 2. Create customer_ledger table
    await queryInterface.createTable('customer_ledger', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'customers', key: 'id' }
      },
      transaction_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      transaction_type: {
        type: Sequelize.ENUM('sale', 'payment', 'credit_note', 'cancellation', 'adjustment'),
        allowNull: false
      },
      reference_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      reference_type: {
        type: Sequelize.ENUM('sale', 'sale_payment', 'credit_note'),
        allowNull: true
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      debit: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Incrementa deuda del cliente (USD)'
      },
      credit: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Reduce deuda del cliente (USD)'
      },
      balance_after: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        comment: 'Snapshot del saldo neto (credit_used - credit_balance) después de esta entrada'
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('customer_ledger', ['customer_id'], { name: 'idx_ledger_customer' });
    await queryInterface.addIndex('customer_ledger', ['transaction_date'], { name: 'idx_ledger_date' });
    await queryInterface.addIndex('customer_ledger', ['reference_type', 'reference_id'], { name: 'idx_ledger_reference' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('customer_ledger');
    const tableDesc = await queryInterface.describeTable('customers');
    if (tableDesc.credit_balance) {
      await queryInterface.removeColumn('customers', 'credit_balance');
    }
  }
};
