'use strict';

/**
 * Separa la escritura de cartera de su lectura.
 *
 * Hasta ahora reversar un abono, validar el PIN de crédito y CAMBIAR ese PIN
 * pedían solo `ar.view`, un permiso que por nombre es de lectura. Lo tenían el
 * rol Contador y la API key de atlas-bot (BOT_PERMISSIONS en middleware/auth.ts),
 * es decir: un chatbot de Messenger con poder de escritura sobre el libro de caja.
 *
 * `ar.manage` se asigna solo a Administrador. El bot conserva `ar.view` y queda
 * limitado a consultar.
 */

module.exports = {
  up: async (queryInterface) => {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'ar.manage' LIMIT 1"
    );

    if (existing.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO permissions (name, description, module, action, created_at, updated_at)
         VALUES ('ar.manage', 'Reversar abonos y administrar el PIN de crédito', 'ar', 'manage', NOW(), NOW())`
      );
    }

    await queryInterface.sequelize.query(
      `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
       SELECT r.id, p.id, NOW(), NOW()
       FROM roles r
       JOIN permissions p ON p.name = 'ar.manage'
       WHERE r.name = 'Administrador'
         AND NOT EXISTS (
           SELECT 1 FROM role_permissions rp
           WHERE rp.role_id = r.id AND rp.permission_id = p.id
         )`
    );
  },

  down: async (queryInterface) => {
    const [perm] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'ar.manage' LIMIT 1"
    );
    if (perm.length > 0) {
      await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE permission_id = ${perm[0].id}`
      );
      await queryInterface.sequelize.query(
        `DELETE FROM permissions WHERE id = ${perm[0].id}`
      );
    }
  },
};
