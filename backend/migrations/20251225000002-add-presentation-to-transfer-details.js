'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('transfer_details');

    // Add presentation_id column
    if (!tableDescription.presentation_id) {
      await queryInterface.addColumn('transfer_details', 'presentation_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'product_presentations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Presentación usada en la transferencia'
      });
    }

    // Add package_quantity column
    if (!tableDescription.package_quantity) {
      await queryInterface.addColumn('transfer_details', 'package_quantity', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Cantidad de paquetes transferidos'
      });
    }

    // Add loose_units column
    if (!tableDescription.loose_units) {
      await queryInterface.addColumn('transfer_details', 'loose_units', {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
        comment: 'Unidades sueltas transferidas'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('transfer_details', 'loose_units');
    await queryInterface.removeColumn('transfer_details', 'package_quantity');
    await queryInterface.removeColumn('transfer_details', 'presentation_id');
  }
};
