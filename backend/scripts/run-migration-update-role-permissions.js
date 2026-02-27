/**
 * Migración: Actualizar permisos de roles existentes
 *
 * Agrega los permisos faltantes a cada rol sin tocar los que ya tienen.
 * Seguro para ejecutar múltiples veces (idempotente).
 *
 * Uso: node backend/scripts/run-migration-update-role-permissions.js
 */
const { Permission, Role, RolePermission } = require('../models');

const ROLE_PERMISSIONS = {
  Despachador: [
    'products.view', 'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'inventory.receive', 'purchases.view', 'purchases.receive', 'reports.view',
    'deliveries.view', 'deliveries.create', 'deliveries.update', 'deliveries.delete'
  ],
  Cajero: [
    'products.view', 'inventory.view', 'sales.quotes.view', 'sales.quotes.create',
    'sales.view', 'sales.create', 'sales.cancel', 'sales.return', 'reports.view',
    'customers.view', 'customers.create', 'customers.update',
    'credit_notes.view', 'credit_notes.create',
    'deliveries.view'
  ],
  Contador: [
    'products.view', 'inventory.view', 'sales.view', 'purchases.view',
    'reports.view', 'reports.export', 'reports.financial',
    'customers.view', 'customers.update',
    'credit_notes.view', 'credit_notes.create', 'credit_notes.approve', 'credit_notes.delete',
    'deliveries.view',
    'supplier_payments.view', 'supplier_payments.create',
    'supplier_payments.update', 'supplier_payments.delete'
  ]
};

async function run() {
  try {
    let totalAdded = 0;

    for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await Role.findOne({ where: { name: roleName } });
      if (!role) {
        console.warn(`⚠️  Rol "${roleName}" no encontrado. Saltando.`);
        continue;
      }

      for (const permName of permNames) {
        const perm = await Permission.findOne({ where: { name: permName } });
        if (!perm) {
          console.warn(`⚠️  Permiso "${permName}" no encontrado en BD.`);
          continue;
        }

        const [, created] = await RolePermission.findOrCreate({
          where: { role_id: role.id, permission_id: perm.id }
        });

        if (created) {
          console.log(`  ✅ [${roleName}] ← ${permName}`);
          totalAdded++;
        }
      }
    }

    if (totalAdded === 0) {
      console.log('ℹ️  Todos los permisos ya estaban asignados. Nada que actualizar.');
    } else {
      console.log(`\n✅ Migración completada: ${totalAdded} permiso(s) agregado(s).`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

run();
