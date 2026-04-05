'use strict';

module.exports = {
  up: async (queryInterface) => {
    // 1. Insertar permiso ar.view si no existe
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM permissions WHERE name = 'ar.view' LIMIT 1`
    );

    let permissionId;
    if (existing.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO permissions (name, description, module, action, created_at, updated_at)
         VALUES ('ar.view', 'Ver módulo Cuentas por Cobrar', 'ar', 'view', NOW(), NOW())`
      );
      const [newPerm] = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE name = 'ar.view' LIMIT 1`
      );
      permissionId = newPerm[0]?.id;
    } else {
      permissionId = existing[0].id;
    }

    if (!permissionId) return;

    // 2. Asignar a todos los roles que tienen 'settings.manage' (= admins)
    const [adminRoles] = await queryInterface.sequelize.query(
      `SELECT DISTINCT rp.role_id FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.name = 'settings.manage'`
    );

    for (const row of adminRoles) {
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
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.name = 'ar.view'`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM permissions WHERE name = 'ar.view'`
    );
  }
};
