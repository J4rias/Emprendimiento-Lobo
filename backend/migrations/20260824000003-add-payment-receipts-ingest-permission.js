'use strict';

/**
 * Permiso del bot de WhatsApp (vision-glm/whatsapp-bot) para subir comprobantes
 * crudos a payment_receipt_intake. Se agrega a BOT_PERMISSIONS en
 * middleware/auth.ts (misma identidad sintética que usa atlas-bot vía
 * X-API-Key). No se asigna a ningún rol humano — es bot-only.
 */

module.exports = {
  up: async (queryInterface) => {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'payment_receipts.ingest' LIMIT 1"
    );

    if (existing.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO permissions (name, description, module, action, created_at, updated_at)
         VALUES ('payment_receipts.ingest', 'Subir comprobantes crudos desde el bot de WhatsApp', 'payment_receipts', 'ingest', NOW(), NOW())`
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      "DELETE FROM permissions WHERE name = 'payment_receipts.ingest'"
    );
  },
};
