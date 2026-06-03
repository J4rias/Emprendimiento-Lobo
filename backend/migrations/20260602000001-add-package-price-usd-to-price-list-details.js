'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('price_list_details');

    if (!tableDesc.package_price_usd) {
      await queryInterface.addColumn('price_list_details', 'package_price_usd', {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
        defaultValue: 0,
        comment: 'Precio de venta por paquete en USD directo (no depende de tasa)'
      });
    }

    // Inicializar con package_price redondeado a 0.5
    await queryInterface.sequelize.query(
      `UPDATE price_list_details SET package_price_usd = ROUND(package_price * 2) / 2 WHERE package_price_usd = 0 AND package_price > 0`
    );
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('price_list_details');
    if (tableDesc.package_price_usd) {
      await queryInterface.removeColumn('price_list_details', 'package_price_usd');
    }
  }
};
