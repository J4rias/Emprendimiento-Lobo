'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('exchange_rates', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      from_currency: {
        type: Sequelize.ENUM('USD', 'COP', 'VES', 'PEN'),
        allowNull: false,
        comment: 'Moneda origen'
      },
      to_currency: {
        type: Sequelize.ENUM('USD', 'COP', 'VES', 'PEN'),
        allowNull: false,
        comment: 'Moneda destino'
      },
      rate: {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
        comment: 'Tasa de cambio (1 from_currency = rate to_currency)'
      },
      effective_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Fecha efectiva de la tasa'
      },
      source: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Fuente de la tasa (ej: BCV, Banco Central, Manual)'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notas adicionales'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Indica si la tasa está activa'
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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

    // Crear índices
    await queryInterface.addIndex('exchange_rates', ['from_currency', 'to_currency', 'effective_date'], {
      unique: true,
      name: 'unique_exchange_rate_per_day'
    });

    await queryInterface.addIndex('exchange_rates', ['effective_date']);
    await queryInterface.addIndex('exchange_rates', ['is_active']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('exchange_rates');
  }
};
