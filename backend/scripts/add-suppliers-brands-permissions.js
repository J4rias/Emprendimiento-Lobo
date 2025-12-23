const { sequelize } = require('../config/database');
const { Permission, RolePermission } = require('../models');

const addSuppliersBrandsPermissions = async () => {
  try {
    console.log('🔄 Adding suppliers and brands permissions...\n');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // Create Suppliers permissions
      console.log('📋 Creating suppliers permissions...');
      const suppliersPermissions = [
        { name: 'suppliers.view', description: 'Ver proveedores', module: 'suppliers', action: 'view' },
        { name: 'suppliers.create', description: 'Crear proveedores', module: 'suppliers', action: 'create' },
        { name: 'suppliers.update', description: 'Actualizar proveedores', module: 'suppliers', action: 'update' },
        { name: 'suppliers.delete', description: 'Eliminar proveedores', module: 'suppliers', action: 'delete' }
      ];

      const createdSuppliersPerms = await Permission.bulkCreate(suppliersPermissions, { transaction });
      console.log(`✅ ${createdSuppliersPerms.length} suppliers permissions created`);

      // Create Brands permissions
      console.log('📋 Creating brands permissions...');
      const brandsPermissions = [
        { name: 'brands.view', description: 'Ver marcas', module: 'brands', action: 'view' },
        { name: 'brands.create', description: 'Crear marcas', module: 'brands', action: 'create' },
        { name: 'brands.update', description: 'Actualizar marcas', module: 'brands', action: 'update' },
        { name: 'brands.delete', description: 'Eliminar marcas', module: 'brands', action: 'delete' }
      ];

      const createdBrandsPerms = await Permission.bulkCreate(brandsPermissions, { transaction });
      console.log(`✅ ${createdBrandsPerms.length} brands permissions created`);

      // Get Admin role
      console.log('🔍 Finding admin role...');
      const { Role } = require('../models');
      const adminRole = await Role.findOne({ 
        where: { name: 'Administrador' },
        transaction 
      });

      if (!adminRole) {
        throw new Error('Admin role not found');
      }
      console.log(`✅ Admin role found (ID: ${adminRole.id})`);

      // Assign all new permissions to Admin role
      console.log('🔗 Assigning permissions to admin role...');
      const allNewPermissions = [...createdSuppliersPerms, ...createdBrandsPerms];
      
      for (const permission of allNewPermissions) {
        await RolePermission.create({
          role_id: adminRole.id,
          permission_id: permission.id
        }, { transaction });
      }
      console.log(`✅ ${allNewPermissions.length} permissions assigned to admin role`);

      // Commit transaction
      await transaction.commit();
      console.log('\n✅ Transaction committed successfully\n');

      console.log('='.repeat(60));
      console.log('✅ Suppliers and Brands permissions added successfully!');
      console.log('='.repeat(60));
      console.log('\n📝 New permissions added:');
      console.log('  • suppliers.view');
      console.log('  • suppliers.create');
      console.log('  • suppliers.update');
      console.log('  • suppliers.delete');
      console.log('  • brands.view');
      console.log('  • brands.create');
      console.log('  • brands.update');
      console.log('  • brands.delete');
      console.log('\n🎯 All permissions assigned to: Administrador');
      console.log('='.repeat(60));

    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Error adding permissions:', error);
    if (error.original?.code === 'UNIQUE_VIOLATION') {
      console.log('\n⚠️  Some permissions may already exist in the database');
    }
    throw error;
  } finally {
    await sequelize.close();
    console.log('\n✓ Database connection closed');
  }
};

// Run if called directly
if (require.main === module) {
  addSuppliersBrandsPermissions()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addSuppliersBrandsPermissions;
