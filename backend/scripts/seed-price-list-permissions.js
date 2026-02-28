/**
 * Script to seed price_lists permissions into the database.
 * Run with: node scripts/seed-price-list-permissions.js
 */
const { sequelize } = require('../config/database');
const { Permission } = require('../models');

const permissions = [
    { name: 'price_lists.view', description: 'Ver listas de precios', module: 'price_lists', action: 'view' },
    { name: 'price_lists.create', description: 'Crear listas de precios', module: 'price_lists', action: 'create' },
    { name: 'price_lists.update', description: 'Actualizar listas de precios', module: 'price_lists', action: 'update' },
    { name: 'price_lists.delete', description: 'Eliminar listas de precios', module: 'price_lists', action: 'delete' },
    { name: 'price_lists.export', description: 'Exportar listas de precios', module: 'price_lists', action: 'export' }
];

async function seedPermissions() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        for (const perm of permissions) {
            const [instance, created] = await Permission.findOrCreate({
                where: { name: perm.name },
                defaults: perm
            });
            console.log(`${created ? '✅ Created' : '⏭️  Already exists'}: ${perm.name}`);
        }

        console.log('\n🎉 Price list permissions seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding permissions:', error);
        process.exit(1);
    }
}

seedPermissions();
