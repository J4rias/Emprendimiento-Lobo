'use strict';

/**
 * `payments.receive` — interruptor global de cobro.
 *
 * Exigido por `middleware/requireMoneyIn.ts` en toda petición que haga entrar
 * dinero (venta de contado, abono sobre pendiente, conversión de pre-pedido con
 * pago), sin importar el módulo. Ni `authorize` ni `hasPermission` hacen bypass
 * de Administrador, así que quitarlo bloquea de verdad a cualquier rol.
 *
 * Como los permisos son por ROL y `admin` compartía "Administrador" con `Lobo`
 * (y con los usuarios de prueba que deja la suite), se crea el rol
 * "Administrador General" = copia exacta de Administrador + este permiso, y
 * SOLO el usuario `admin` se mueve ahí. "Administrador" queda intacto y sin
 * poder cobrar.
 */

const ROLE_NAME = 'Administrador General';
const PERMISSION = 'payments.receive';

module.exports = {
  up: async (queryInterface) => {
    const q = queryInterface.sequelize;

    // 1. El permiso
    const [existingPerm] = await q.query(
      `SELECT id FROM permissions WHERE name = :name LIMIT 1`,
      { replacements: { name: PERMISSION } }
    );
    if (existingPerm.length === 0) {
      await q.query(
        `INSERT INTO permissions (name, description, module, action, created_at, updated_at)
         VALUES (:name, 'Recibir pagos (cobrar) en cualquier módulo', 'payments', 'receive', NOW(), NOW())`,
        { replacements: { name: PERMISSION } }
      );
    }

    // 2. El rol, como copia de Administrador
    const [existingRole] = await q.query(
      `SELECT id FROM roles WHERE name = :name AND deleted_at IS NULL LIMIT 1`,
      { replacements: { name: ROLE_NAME } }
    );
    if (existingRole.length === 0) {
      await q.query(
        `INSERT INTO roles (name, description, is_active, created_at, updated_at)
         VALUES (:name, 'Administrador con permiso de cobro habilitado', 1, NOW(), NOW())`,
        { replacements: { name: ROLE_NAME } }
      );
      await q.query(
        `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
         SELECT nuevo.id, rp.permission_id, NOW(), NOW()
         FROM roles nuevo
         JOIN roles admin ON admin.name = 'Administrador' AND admin.deleted_at IS NULL
         JOIN role_permissions rp ON rp.role_id = admin.id
         WHERE nuevo.name = :name AND nuevo.deleted_at IS NULL`,
        { replacements: { name: ROLE_NAME } }
      );
    }

    // 3. El permiso nuevo, solo al rol nuevo
    await q.query(
      `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
       SELECT r.id, p.id, NOW(), NOW()
       FROM roles r
       JOIN permissions p ON p.name = :permission
       WHERE r.name = :role AND r.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM role_permissions rp
           WHERE rp.role_id = r.id AND rp.permission_id = p.id
         )`,
      { replacements: { role: ROLE_NAME, permission: PERMISSION } }
    );

    // 4. Mover SOLO al usuario admin
    await q.query(
      `UPDATE users u
       JOIN roles r ON r.name = :role AND r.deleted_at IS NULL
       SET u.role_id = r.id, u.updated_at = NOW()
       WHERE u.username = 'admin'`,
      { replacements: { role: ROLE_NAME } }
    );
  },

  down: async (queryInterface) => {
    const q = queryInterface.sequelize;

    // Devolver admin a Administrador
    await q.query(
      `UPDATE users u
       JOIN roles r ON r.name = 'Administrador' AND r.deleted_at IS NULL
       SET u.role_id = r.id, u.updated_at = NOW()
       WHERE u.username = 'admin'`
    );

    await q.query(
      `DELETE rp FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = :role`,
      { replacements: { role: ROLE_NAME } }
    );
    await q.query(`DELETE FROM roles WHERE name = :role`, { replacements: { role: ROLE_NAME } });

    await q.query(
      `DELETE rp FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.name = :permission`,
      { replacements: { permission: PERMISSION } }
    );
    await q.query(`DELETE FROM permissions WHERE name = :permission`, { replacements: { permission: PERMISSION } });
  },
};
