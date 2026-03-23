'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pos_reservations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      session_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        comment: 'UUID de la sesión del POS (identificador de dispositivo/navegador)'
      },
      tab_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        comment: 'UUID de la pestaña dentro de la sesión'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'Vendedor que hizo la reserva'
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        }
      },
      presentation_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'product_presentations',
          key: 'id'
        }
      },
      units_reserved: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Unidades reservadas (en unidades base, equivalentes a inventory.quantity)'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'TTL: timestamp de expiración de la reserva (seguridad ante crash)'
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

    // Crear índices
    await queryInterface.addIndex('pos_reservations', {
      fields: ['session_id', 'tab_id', 'presentation_id'],
      unique: true,
      name: 'unique_pos_reservation'
    });

    await queryInterface.addIndex('pos_reservations', {
      fields: ['product_id'],
      name: 'idx_pos_product_id'
    });

    await queryInterface.addIndex('pos_reservations', {
      fields: ['session_id', 'tab_id'],
      name: 'idx_pos_session_tab'
    });

    await queryInterface.addIndex('pos_reservations', {
      fields: ['expires_at'],
      name: 'idx_pos_expires_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('pos_reservations');
  }
};
