'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pre_orders', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'customers', key: 'id' }
      },
      customer_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      customer_phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      channel: {
        type: Sequelize.ENUM('messenger', 'telegram', 'web'),
        allowNull: false,
        defaultValue: 'messenger'
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'converted', 'expired'),
        allowNull: false,
        defaultValue: 'pending'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      subtotal: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0
      },
      total: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'USD'
      },
      exchange_rate: {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: true
      },
      converted_sale_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'sales', key: 'id' }
      },
      approved_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      warehouse_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'warehouses', key: 'id' }
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    await queryInterface.addIndex('pre_orders', ['code']);
    await queryInterface.addIndex('pre_orders', ['status']);
    await queryInterface.addIndex('pre_orders', ['customer_id']);
    await queryInterface.addIndex('pre_orders', ['channel']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('pre_orders');
  }
};
