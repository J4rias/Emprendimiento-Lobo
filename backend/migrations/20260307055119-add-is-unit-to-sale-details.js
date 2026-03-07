'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('sale_details', 'is_unit', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si la venta se hizo por unidad (true) o por bulto/empaque (false)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('sale_details', 'is_unit');
  }
};
