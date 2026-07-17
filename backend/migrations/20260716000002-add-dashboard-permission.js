'use strict';

module.exports = {
  up: async (queryInterface) => {
    // 1. Insert 'dashboard.view' permission
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'dashboard.view' LIMIT 1"
    );
    if (existing.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO permissions (name, description, module, action, created_at, updated_at)
         VALUES ('dashboard.view', 'Ver dashboard principal', 'dashboard', 'view', NOW(), NOW())`
      );
    }

    // 2. Assign to all existing roles (backward compatible — everyone keeps access)
    const [perm] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'dashboard.view' LIMIT 1"
    );
    if (perm.length > 0) {
      const permId = perm[0].id;
      const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles");
      for (const role of roles) {
        const [exists] = await queryInterface.sequelize.query(
          `SELECT 1 FROM role_permissions WHERE role_id = ${role.id} AND permission_id = ${permId} LIMIT 1`
        );
        if (exists.length === 0) {
          await queryInterface.sequelize.query(
            `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
             VALUES (${role.id}, ${permId}, NOW(), NOW())`
          );
        }
      }
    }
  },

  down: async (queryInterface) => {
    const [perm] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'dashboard.view' LIMIT 1"
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
