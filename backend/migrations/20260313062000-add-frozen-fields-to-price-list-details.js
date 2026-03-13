'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('price_list_details', 'is_frozen', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si el precio está congelado (fijo)'
    });

    await queryInterface.addColumn('price_list_details', 'frozen_price', {
      type: Sequelize.DECIMAL(18, 6),
      allowNull: true,
      comment: 'Precio congelado'
    });

    await queryInterface.addColumn('price_list_details', 'frozen_currency', {
      type: Sequelize.STRING(3),
      allowNull: true,
      defaultValue: 'USD',
      comment: 'Moneda en la que se congeló el precio'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('price_list_details', 'is_frozen');
    await queryInterface.removeColumn('price_list_details', 'frozen_price');
    await queryInterface.removeColumn('price_list_details', 'frozen_currency');
  }
};
