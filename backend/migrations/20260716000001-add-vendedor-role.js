'use strict';

const VENDEDOR_PERMS = [
  'products.view',
  'sales.view',
  'sales.create',
  'customers.view',
  'customers.create',
];

module.exports = {
  up: async (queryInterface) => {
    // 1. Add 'pos_pending' to sale_type ENUM
    await queryInterface.sequelize.query(
      "ALTER TABLE sales MODIFY COLUMN sale_type ENUM('cash','credit','mixed','pos_pending') NOT NULL DEFAULT 'cash'"
    );

    // 2. Insert 'sales.collect' permission
    const [existingPerm] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'sales.collect' LIMIT 1"
    );
    if (existingPerm.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO permissions (name, description, module, action, created_at, updated_at)
         VALUES ('sales.collect', 'Cobrar ventas (POS)', 'sales', 'collect', NOW(), NOW())`
      );
    }

    // 3. Assign sales.collect to Admin roles (roles that have settings.manage)
    const [collectPerm] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'sales.collect' LIMIT 1"
    );
    if (collectPerm.length > 0) {
      const collectId = collectPerm[0].id;

      const [adminRoles] = await queryInterface.sequelize.query(
        `SELECT DISTINCT rp.role_id FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE p.name = 'settings.manage'`
      );
      for (const row of adminRoles) {
        const [already] = await queryInterface.sequelize.query(
          `SELECT id FROM role_permissions WHERE role_id = ${row.role_id} AND permission_id = ${collectId} LIMIT 1`
        );
        if (already.length === 0) {
          await queryInterface.sequelize.query(
            `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
             VALUES (${row.role_id}, ${collectId}, NOW(), NOW())`
          );
        }
      }

      // 4. Assign sales.collect to Cajero role
      const [cajeroRoles] = await queryInterface.sequelize.query(
        "SELECT id FROM roles WHERE name = 'Cajero' LIMIT 1"
      );
      for (const row of cajeroRoles) {
        const [already] = await queryInterface.sequelize.query(
          `SELECT id FROM role_permissions WHERE role_id = ${row.id} AND permission_id = ${collectId} LIMIT 1`
        );
        if (already.length === 0) {
          await queryInterface.sequelize.query(
            `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
             VALUES (${row.id}, ${collectId}, NOW(), NOW())`
          );
        }
      }
    }

    // 5. Create Vendedor role
    const [existingRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'Vendedor' LIMIT 1"
    );
    let vendedorRoleId;
    if (existingRole.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO roles (name, description, created_at, updated_at)
         VALUES ('Vendedor', 'Carga artículos en POS, no cobra ni imprime', NOW(), NOW())`
      );
      const [newRole] = await queryInterface.sequelize.query(
        "SELECT id FROM roles WHERE name = 'Vendedor' LIMIT 1"
      );
      vendedorRoleId = newRole[0].id;
    } else {
      vendedorRoleId = existingRole[0].id;
    }

    // 6. Assign permissions to Vendedor role
    for (const permName of VENDEDOR_PERMS) {
      const [perm] = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE name = '${permName}' LIMIT 1`
      );
      if (perm.length === 0) continue;
      const [already] = await queryInterface.sequelize.query(
        `SELECT id FROM role_permissions WHERE role_id = ${vendedorRoleId} AND permission_id = ${perm[0].id} LIMIT 1`
      );
      if (already.length === 0) {
        await queryInterface.sequelize.query(
          `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
           VALUES (${vendedorRoleId}, ${perm[0].id}, NOW(), NOW())`
        );
      }
    }
  },

  down: async (queryInterface) => {
    // Revert ENUM
    await queryInterface.sequelize.query(
      "ALTER TABLE sales MODIFY COLUMN sale_type ENUM('cash','credit','mixed') NOT NULL DEFAULT 'cash'"
    );

    // Remove Vendedor role and its permissions
    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'Vendedor'`
    );
    await queryInterface.sequelize.query(
      "DELETE FROM roles WHERE name = 'Vendedor'"
    );

    // Remove sales.collect permission and its assignments
    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.name = 'sales.collect'`
    );
    await queryInterface.sequelize.query(
      "DELETE FROM permissions WHERE name = 'sales.collect'"
    );
  }
};
