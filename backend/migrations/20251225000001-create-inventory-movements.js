module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('inventory_movements', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      warehouse_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'warehouses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      presentation_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'product_presentations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      movement_type: {
        type: Sequelize.ENUM('ingreso', 'egreso', 'ajuste_positivo', 'ajuste_negativo', 'transferencia'),
        allowNull: false
      },
      package_quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      loose_units: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      unit_cost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      package_cost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      currency: {
        type: Sequelize.ENUM('USD', 'COP', 'VES'),
        defaultValue: 'USD'
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      document_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      batch_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'batches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Índices para mejorar consultas
    await queryInterface.addIndex('inventory_movements', ['product_id']);
    await queryInterface.addIndex('inventory_movements', ['warehouse_id']);
    await queryInterface.addIndex('inventory_movements', ['presentation_id']);
    await queryInterface.addIndex('inventory_movements', ['movement_type']);
    await queryInterface.addIndex('inventory_movements', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('inventory_movements');
  }
};
