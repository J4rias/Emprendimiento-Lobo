'use strict';

module.exports = {
  up: async (queryInterface) => {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'sales.credit' LIMIT 1"
    );
    if (existing.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO permissions (name, description, module, action, created_at, updated_at)
         VALUES ('sales.credit', 'Vender a crédito (POS)', 'sales', 'credit', NOW(), NOW())`
      );
    }
  },

  down: async (queryInterface) => {
    const [perm] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'sales.credit' LIMIT 1"
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
