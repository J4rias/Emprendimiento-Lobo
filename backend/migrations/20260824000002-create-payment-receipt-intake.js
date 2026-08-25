'use strict';

/**
 * Tabla de ingesta cruda para los comprobantes que llegan del bot de WhatsApp
 * (vision-glm/whatsapp-bot + invoice_glm.py). Angosta a propósito: guarda el
 * comprobante tal cual lo extrae GLM, sin match automático todavía — ver
 * docs/plan-comprobantes-whatsapp-erp.md. `flow` distingue ventas/compras
 * desde ya aunque hoy solo se use 'ventas', para no migrar de nuevo cuando
 * se agregue el grupo de compras.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('payment_receipt_intake', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      flow: {
        type: Sequelize.ENUM('ventas', 'compras'),
        allowNull: false,
        defaultValue: 'ventas',
      },
      status: {
        type: Sequelize.ENUM('pendiente', 'conciliado', 'sin_match', 'conflicto'),
        allowNull: false,
        defaultValue: 'pendiente',
      },
      banco: { type: Sequelize.STRING(100), allowNull: true },
      fecha: { type: Sequelize.DATEONLY, allowNull: true },
      referencia: { type: Sequelize.STRING(100), allowNull: true },
      monto: { type: Sequelize.DECIMAL(18, 6), allowNull: true },
      moneda: { type: Sequelize.STRING(20), allowNull: true, comment: 'Texto tal cual lo extrae GLM (ej. "$", "Bs", "USDT"), no el ENUM de 3 monedas del ERP' },
      origen_nombre: { type: Sequelize.STRING(150), allowNull: true },
      origen_cuenta: { type: Sequelize.STRING(100), allowNull: true },
      destino_nombre: { type: Sequelize.STRING(150), allowNull: true },
      destino_cuenta: { type: Sequelize.STRING(100), allowNull: true },
      concepto: { type: Sequelize.TEXT, allowNull: true },
      tipo_pantalla: { type: Sequelize.STRING(100), allowNull: true },
      image_url: { type: Sequelize.STRING(255), allowNull: true },
      confidence: { type: Sequelize.DECIMAL(5, 2), allowNull: true, comment: '0-100, si el bot la reporta' },
      raw_payload: { type: Sequelize.JSON, allowNull: true, comment: 'JSON crudo recibido del bot, para auditoría' },
      sale_payment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'sale_payments', key: 'id' },
        comment: 'Se llena cuando exista el motor de matching (fase posterior)',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('payment_receipt_intake', ['flow', 'status']);
    await queryInterface.addIndex('payment_receipt_intake', ['fecha']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('payment_receipt_intake');
  },
};
