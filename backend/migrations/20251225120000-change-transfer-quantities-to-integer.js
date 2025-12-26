'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change package_quantity and loose_units to INTEGER in transfer_details table
    await queryInterface.changeColumn('transfer_details', 'package_quantity', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Cantidad de paquetes transferidos'
    });

    await queryInterface.changeColumn('transfer_details', 'loose_units', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Unidades sueltas transferidas'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to DECIMAL
    await queryInterface.changeColumn('transfer_details', 'package_quantity', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Cantidad de paquetes transferidos'
    });

    await queryInterface.changeColumn('transfer_details', 'loose_units', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
      comment: 'Unidades sueltas transferidas'
    });
  }
};
