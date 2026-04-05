'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Verificar si las columnas ya existen
      const tableDescription = await queryInterface.describeTable('price_list_details');

      if (!tableDescription.is_frozen) {
        await queryInterface.addColumn('price_list_details', 'is_frozen', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Indica si el precio está congelado (fijo)'
        });
      }

      if (!tableDescription.frozen_price) {
        await queryInterface.addColumn('price_list_details', 'frozen_price', {
          type: Sequelize.DECIMAL(18, 6),
          allowNull: true,
          comment: 'Precio congelado'
        });
      }

      if (!tableDescription.frozen_currency) {
        await queryInterface.addColumn('price_list_details', 'frozen_currency', {
          type: Sequelize.STRING(3),
          allowNull: true,
          defaultValue: 'USD',
          comment: 'Moneda en la que se congeló el precio'
        });
      }
    } catch (error) {
      // Si el error es que la columna ya existe, ignorar
      if (error.message && error.message.includes('Duplicate column')) {
        console.log('Columnas ya existen, continuando...');
      } else {
        throw error;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('price_list_details', 'is_frozen');
    await queryInterface.removeColumn('price_list_details', 'frozen_price');
    await queryInterface.removeColumn('price_list_details', 'frozen_currency');
  }
};
