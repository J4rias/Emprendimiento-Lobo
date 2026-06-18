'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pre_order_details', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      pre_order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'pre_orders', key: 'id' },
        onDelete: 'CASCADE'
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'products', key: 'id' }
      },
      presentation_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'product_presentations', key: 'id' }
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      is_unit: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      unit_price: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      total: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      notes: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('pre_order_details', ['pre_order_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('pre_order_details');
  }
};
