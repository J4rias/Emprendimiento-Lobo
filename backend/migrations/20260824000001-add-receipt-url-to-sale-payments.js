'use strict';

/**
 * Foto del comprobante (transferencia/USDT) adjunta al momento de cobrar.
 * Nullable y hacia adelante: no aplica a pagos históricos, ver
 * docs/plan-comprobantes-whatsapp-erp.md.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('sale_payments', 'receipt_url', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'URL de la foto del comprobante (transferencia/USDT), si se adjuntó',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('sale_payments', 'receipt_url');
  },
};
