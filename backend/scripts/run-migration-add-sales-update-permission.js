/**
 * Migración puntual: agrega el permiso 'sales.update' a la tabla permissions
 * y lo asigna al rol Administrador si no estaba ya asignado.
 *
 * Uso: node backend/scripts/run-migration-add-sales-update-permission.js
 */
const { sequelize } = require('../config/database');
const { Permission, Role, RolePermission } = require('../models');

async function run() {
  try {
    // 1. Insertar permiso si no existe
    const [permission, created] = await Permission.findOrCreate({
      where: { name: 'sales.update' },
      defaults: {
        name: 'sales.update',
        description: 'Actualizar ventas',
        module: 'sales',
        action: 'update'
      }
    });

    if (created) {
      console.log('✅ Permiso "sales.update" creado.');
    } else {
      console.log('ℹ️  Permiso "sales.update" ya existía.');
    }

    // 2. Asignar al rol Administrador
    const adminRole = await Role.findOne({ where: { name: 'Administrador' } });
    if (!adminRole) {
      console.error('❌ Rol Administrador no encontrado. ¿Fue ejecutado init-db.js?');
      process.exit(1);
    }

    const [, assignedNow] = await RolePermission.findOrCreate({
      where: { role_id: adminRole.id, permission_id: permission.id }
    });

    if (assignedNow) {
      console.log('✅ Permiso "sales.update" asignado al rol Administrador.');
    } else {
      console.log('ℹ️  Permiso "sales.update" ya estaba asignado al Administrador.');
    }

    console.log('\n✅ Migración completada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

run();
