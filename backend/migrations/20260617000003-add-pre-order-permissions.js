'use strict';

const PERMISSIONS = [
  { name: 'pre_orders.view', description: 'Ver pre-pedidos', module: 'pre_orders', action: 'view' },
  { name: 'pre_orders.create', description: 'Crear pre-pedidos', module: 'pre_orders', action: 'create' },
  { name: 'pre_orders.approve', description: 'Aprobar/rechazar pre-pedidos', module: 'pre_orders', action: 'approve' },
  { name: 'pre_orders.manage', description: 'Gestionar pre-pedidos', module: 'pre_orders', action: 'manage' },
];

module.exports = {
  up: async (queryInterface) => {
    // 1. Insert permissions
    for (const perm of PERMISSIONS) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE name = '${perm.name}' LIMIT 1`
      );
      if (existing.length === 0) {
        await queryInterface.sequelize.query(
          `INSERT INTO permissions (name, description, module, action, created_at, updated_at)
           VALUES ('${perm.name}', '${perm.description}', '${perm.module}', '${perm.action}', NOW(), NOW())`
        );
      }
    }

    // 2. Assign all to admin roles (roles that have settings.manage)
    const [adminRoles] = await queryInterface.sequelize.query(
      `SELECT DISTINCT rp.role_id FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.name = 'settings.manage'`
    );

    for (const row of adminRoles) {
      for (const perm of PERMISSIONS) {
        const [permRow] = await queryInterface.sequelize.query(
          `SELECT id FROM permissions WHERE name = '${perm.name}' LIMIT 1`
        );
        if (permRow.length === 0) continue;
        const permissionId = permRow[0].id;

        const [alreadyAssigned] = await queryInterface.sequelize.query(
          `SELECT id FROM role_permissions WHERE role_id = ${row.role_id} AND permission_id = ${permissionId} LIMIT 1`
        );
        if (alreadyAssigned.length === 0) {
          await queryInterface.sequelize.query(
            `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
             VALUES (${row.role_id}, ${permissionId}, NOW(), NOW())`
          );
        }
      }
    }
  },

  down: async (queryInterface) => {
    for (const perm of PERMISSIONS) {
      await queryInterface.sequelize.query(
        `DELETE rp FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE p.name = '${perm.name}'`
      );
      await queryInterface.sequelize.query(
        `DELETE FROM permissions WHERE name = '${perm.name}'`
      );
    }
  }
};
