/**
 * Assign price_lists permissions to the admin role (role_id = 1).
 * Run with: node scripts/assign-pricelist-perms-to-admin.js
 */
const { sequelize } = require('../config/database');
const { Permission, RolePermission } = require('../models');

async function assign() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        const permissions = await Permission.findAll({
            where: { module: 'price_lists' }
        });

        for (const perm of permissions) {
            const [, created] = await RolePermission.findOrCreate({
                where: { role_id: 1, permission_id: perm.id },
                defaults: { role_id: 1, permission_id: perm.id }
            });
            console.log(`${created ? '✅ Assigned' : '⏭️  Already assigned'}: ${perm.name} → Admin`);
        }

        console.log('\n🎉 Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

assign();
