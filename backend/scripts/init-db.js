const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');
const { User, Role, Permission, RolePermission, Category, Warehouse, Customer, PriceList, Brand, CompanySettings } = require('../models');
const fs = require('fs');
const path = require('path');
const addIndexes = require('./run-migration-add-indexes');
require('dotenv').config();

const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database...\n');

    // Sync database
    console.log('📊 Syncing database schema...');
    await sequelize.sync({ force: true }); // WARNING: This will drop all tables
    console.log('✅ Database schema synced\n');

    // Create Roles
    console.log('👥 Creating roles...');
    const adminRole = await Role.create({
      name: 'Administrador',
      description: 'Acceso total al sistema'
    });

    const despachadorRole = await Role.create({
      name: 'Despachador',
      description: 'Gestión de inventario y despachos'
    });

    const cajeroRole = await Role.create({
      name: 'Cajero',
      description: 'Punto de venta y cobros'
    });

    const contadorRole = await Role.create({
      name: 'Contador',
      description: 'Reportes financieros y facturación'
    });
    console.log('✅ Roles created\n');

    // Create Permissions
    console.log('🔐 Creating permissions...');
    const permissions = [
      // Products
      { name: 'products.view', description: 'Ver productos', module: 'products', action: 'view' },
      { name: 'products.create', description: 'Crear productos', module: 'products', action: 'create' },
      { name: 'products.update', description: 'Actualizar productos', module: 'products', action: 'update' },
      { name: 'products.delete', description: 'Eliminar productos', module: 'products', action: 'delete' },

      // Suppliers
      { name: 'suppliers.view', description: 'Ver proveedores', module: 'suppliers', action: 'view' },
      { name: 'suppliers.create', description: 'Crear proveedores', module: 'suppliers', action: 'create' },
      { name: 'suppliers.update', description: 'Actualizar proveedores', module: 'suppliers', action: 'update' },
      { name: 'suppliers.delete', description: 'Eliminar proveedores', module: 'suppliers', action: 'delete' },

      // Brands
      { name: 'brands.view', description: 'Ver marcas', module: 'brands', action: 'view' },
      { name: 'brands.create', description: 'Crear marcas', module: 'brands', action: 'create' },
      { name: 'brands.update', description: 'Actualizar marcas', module: 'brands', action: 'update' },
      { name: 'brands.delete', description: 'Eliminar marcas', module: 'brands', action: 'delete' },

      // Inventory
      { name: 'inventory.view', description: 'Ver inventario', module: 'inventory', action: 'view' },
      { name: 'inventory.adjust', description: 'Ajustar inventario', module: 'inventory', action: 'adjust' },
      { name: 'inventory.transfer', description: 'Realizar traslados', module: 'inventory', action: 'transfer' },
      { name: 'inventory.receive', description: 'Recibir traslados', module: 'inventory', action: 'receive' },

      // Quotes
      { name: 'sales.quotes.view', description: 'Ver cotizaciones', module: 'sales', action: 'view' },
      { name: 'sales.quotes.create', description: 'Crear cotizaciones', module: 'sales', action: 'create' },
      { name: 'sales.quotes.update', description: 'Actualizar cotizaciones', module: 'sales', action: 'update' },
      { name: 'sales.quotes.delete', description: 'Eliminar cotizaciones', module: 'sales', action: 'delete' },

      // Sales
      { name: 'sales.view', description: 'Ver ventas', module: 'sales', action: 'view' },
      { name: 'sales.create', description: 'Crear ventas', module: 'sales', action: 'create' },
      { name: 'sales.update', description: 'Actualizar ventas', module: 'sales', action: 'update' },
      { name: 'sales.cancel', description: 'Cancelar ventas', module: 'sales', action: 'cancel' },
      { name: 'sales.return', description: 'Procesar devoluciones', module: 'sales', action: 'return' },

      // Purchases
      { name: 'purchases.view', description: 'Ver compras', module: 'purchases', action: 'view' },
      { name: 'purchases.create', description: 'Crear órdenes de compra', module: 'purchases', action: 'create' },
      { name: 'purchases.approve', description: 'Aprobar órdenes de compra', module: 'purchases', action: 'approve' },
      { name: 'purchases.receive', description: 'Recibir compras', module: 'purchases', action: 'receive' },
      { name: 'purchases.update', description: 'Actualizar órdenes de compra', module: 'purchases', action: 'update' },
      { name: 'purchases.delete', description: 'Eliminar órdenes de compra', module: 'purchases', action: 'delete' },

      // Customers
      { name: 'customers.view', description: 'Ver clientes', module: 'customers', action: 'view' },
      { name: 'customers.create', description: 'Crear clientes', module: 'customers', action: 'create' },
      { name: 'customers.update', description: 'Actualizar clientes', module: 'customers', action: 'update' },
      { name: 'customers.delete', description: 'Eliminar clientes', module: 'customers', action: 'delete' },

      // Credit Notes
      { name: 'credit_notes.view', description: 'Ver notas de crédito', module: 'credit_notes', action: 'view' },
      { name: 'credit_notes.create', description: 'Crear notas de crédito', module: 'credit_notes', action: 'create' },
      { name: 'credit_notes.update', description: 'Actualizar notas de crédito', module: 'credit_notes', action: 'update' },
      { name: 'credit_notes.approve', description: 'Aprobar notas de crédito', module: 'credit_notes', action: 'approve' },
      { name: 'credit_notes.delete', description: 'Eliminar notas de crédito', module: 'credit_notes', action: 'delete' },

      // Deliveries
      { name: 'deliveries.view', description: 'Ver entregas', module: 'deliveries', action: 'view' },
      { name: 'deliveries.create', description: 'Crear entregas', module: 'deliveries', action: 'create' },
      { name: 'deliveries.update', description: 'Actualizar entregas', module: 'deliveries', action: 'update' },
      { name: 'deliveries.delete', description: 'Cancelar entregas', module: 'deliveries', action: 'delete' },

      // Supplier Payments
      { name: 'supplier_payments.view', description: 'Ver pagos a proveedores', module: 'supplier_payments', action: 'view' },
      { name: 'supplier_payments.create', description: 'Registrar pagos a proveedores', module: 'supplier_payments', action: 'create' },
      { name: 'supplier_payments.update', description: 'Actualizar pagos a proveedores', module: 'supplier_payments', action: 'update' },
      { name: 'supplier_payments.delete', description: 'Eliminar pagos a proveedores', module: 'supplier_payments', action: 'delete' },

      // Reports
      { name: 'reports.view', description: 'Ver reportes', module: 'reports', action: 'view' },
      { name: 'reports.export', description: 'Exportar reportes', module: 'reports', action: 'export' },
      { name: 'reports.financial', description: 'Ver reportes financieros', module: 'reports', action: 'financial' },

      // Users
      { name: 'users.view', description: 'Ver usuarios', module: 'users', action: 'view' },
      { name: 'users.create', description: 'Crear usuarios', module: 'users', action: 'create' },
      { name: 'users.update', description: 'Actualizar usuarios', module: 'users', action: 'update' },
      { name: 'users.delete', description: 'Eliminar usuarios', module: 'users', action: 'delete' },
      { name: 'roles.manage', description: 'Gestionar roles y permisos', module: 'roles', action: 'manage' },
      { name: 'settings.manage', description: 'Gestionar configuraciones', module: 'settings', action: 'manage' }
    ];

    const createdPermissions = await Permission.bulkCreate(permissions);
    console.log(`✅ ${createdPermissions.length} permissions created\n`);

    // Assign all permissions to Admin role
    console.log('🔗 Assigning permissions to roles...');
    for (const permission of createdPermissions) {
      await RolePermission.create({
        role_id: adminRole.id,
        permission_id: permission.id
      });
    }

    // Assign permissions to Despachador
    const despachadorPerms = createdPermissions.filter(p =>
      ['products.view', 'inventory.view', 'inventory.adjust', 'inventory.transfer',
       'inventory.receive', 'purchases.view', 'purchases.receive', 'reports.view',
       'deliveries.view', 'deliveries.create', 'deliveries.update', 'deliveries.delete'].includes(p.name)
    );
    for (const permission of despachadorPerms) {
      await RolePermission.create({
        role_id: despachadorRole.id,
        permission_id: permission.id
      });
    }

    // Assign permissions to Cajero
    const cajeroPerms = createdPermissions.filter(p =>
      ['products.view', 'inventory.view', 'sales.quotes.view', 'sales.quotes.create',
       'sales.view', 'sales.create', 'sales.cancel', 'sales.return', 'reports.view',
       'customers.view', 'customers.create', 'customers.update',
       'credit_notes.view', 'credit_notes.create',
       'deliveries.view'].includes(p.name)
    );
    for (const permission of cajeroPerms) {
      await RolePermission.create({
        role_id: cajeroRole.id,
        permission_id: permission.id
      });
    }

    // Assign permissions to Contador
    const contadorPerms = createdPermissions.filter(p =>
      ['products.view', 'inventory.view', 'sales.view', 'purchases.view',
       'reports.view', 'reports.export', 'reports.financial',
       'customers.view', 'customers.update',
       'credit_notes.view', 'credit_notes.create', 'credit_notes.approve', 'credit_notes.delete',
       'deliveries.view',
       'supplier_payments.view', 'supplier_payments.create', 'supplier_payments.update', 'supplier_payments.delete'].includes(p.name)
    );
    for (const permission of contadorPerms) {
      await RolePermission.create({
        role_id: contadorRole.id,
        permission_id: permission.id
      });
    }
    console.log('✅ Permissions assigned to roles\n');

    // Create Admin User
    console.log('👤 Creating admin user...');
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@viveres.com',
      password: 'Admin123!',  // El hook beforeCreate se encargará del hash
      first_name: 'Admin',
      last_name: 'Sistema',
      role_id: adminRole.id,
      is_active: true
    });
    console.log('✅ Admin user created\n');

    // Create Categories
    console.log('📂 Creating categories...');
    const categories = [
      { code: 'LAC', name: 'Lácteos', description: 'Productos lácteos y derivados' },
      { code: 'GRA', name: 'Granos', description: 'Granos, legumbres y cereales' },
      { code: 'ACE', name: 'Aceites', description: 'Aceites comestibles' },
      { code: 'BEB', name: 'Bebidas', description: 'Bebidas no alcohólicas' },
      { code: 'ENL', name: 'Enlatados', description: 'Productos enlatados y conservas' },
      { code: 'LIM', name: 'Limpieza', description: 'Productos de limpieza' },
      { code: 'HIG', name: 'Higiene', description: 'Productos de higiene personal' },
      { code: 'CHU', name: 'Chucherías', description: 'Dulces y golosinas' },
      { code: 'PAN', name: 'Panadería', description: 'Productos de panadería' },
      { code: 'CAR', name: 'Carnes', description: 'Carnes y embutidos' }
    ];
    await Category.bulkCreate(categories);
    console.log(`✅ ${categories.length} categories created\n`);

    // Create Warehouses
    console.log('🏢 Creating warehouses...');
    const warehouses = [
      {
        code: 'MAIN',
        name: 'Depósito Principal',
        description: 'Almacén principal de distribución',
        city: 'Caracas',
        state: 'Miranda',
        is_main: true
      },
      {
        code: 'SUC01',
        name: 'Sucursal 1',
        description: 'Punto de venta sucursal 1',
        city: 'Caracas',
        state: 'Miranda',
        is_main: false
      },
      {
        code: 'SUC02',
        name: 'Sucursal 2',
        description: 'Punto de venta sucursal 2',
        city: 'Maracay',
        state: 'Aragua',
        is_main: false
      }
    ];
    await Warehouse.bulkCreate(warehouses);
    console.log(`✅ ${warehouses.length} warehouses created\n`);

    // Create Price Lists
    console.log('💰 Creating price lists...');
    const priceLists = [
      {
        code: 'LP-0001',
        name: 'Precio Público',
        description: 'Lista de precios para clientes minoristas',
        currency: 'USD',
        basePercentage: 30,
        isDefault: true,
        status: 'active'
      },
      {
        code: 'LP-0002',
        name: 'Precio Mayorista',
        description: 'Lista de precios para clientes mayoristas',
        currency: 'USD',
        basePercentage: 20,
        isDefault: false,
        status: 'active'
      },
      {
        code: 'LP-0003',
        name: 'Precio Distribuidor',
        description: 'Lista de precios para distribuidores',
        currency: 'USD',
        basePercentage: 15,
        isDefault: false,
        status: 'active'
      }
    ];
    const createdPriceLists = await PriceList.bulkCreate(priceLists);
    console.log(`✅ ${priceLists.length} price lists created\n`);

    // Create Sample Customers
    console.log('👥 Creating sample customers...');
    const customers = [
      {
        code: 'CLI-00001',
        type: 'natural',
        documentType: 'DNI',
        documentNumber: '12345678',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@example.com',
        phone: '987654321',
        address: 'Av. Principal 123',
        city: 'Lima',
        country: 'Perú',
        creditLimit: 5000,
        creditDays: 30,
        priceListId: createdPriceLists[0].id,
        status: 'active'
      },
      {
        code: 'CLI-00002',
        type: 'juridical',
        documentType: 'RUC',
        documentNumber: '20123456789',
        businessName: 'Comercial El Buen Precio SAC',
        tradeName: 'El Buen Precio',
        email: 'ventas@buenprecio.com',
        phone: '014567890',
        address: 'Jr. Comercio 456',
        city: 'Lima',
        country: 'Perú',
        creditLimit: 20000,
        creditDays: 60,
        priceListId: createdPriceLists[1].id,
        discountPercentage: 5,
        status: 'active'
      },
      {
        code: 'CLI-00003',
        type: 'juridical',
        documentType: 'RUC',
        documentNumber: '20987654321',
        businessName: 'Distribuidora Norte EIRL',
        tradeName: 'Distri Norte',
        email: 'contacto@distrinorte.com',
        phone: '019876543',
        address: 'Av. Industrial 789',
        city: 'Trujillo',
        country: 'Perú',
        creditLimit: 50000,
        creditDays: 90,
        priceListId: createdPriceLists[2].id,
        discountPercentage: 10,
        status: 'active'
      }
    ];
    await Customer.bulkCreate(customers);
    console.log(`✅ ${customers.length} customers created\n`);

    // Restore brands from backup if exists
    const BACKUP_FILE = path.join(__dirname, 'brands-backup.json');
    if (fs.existsSync(BACKUP_FILE)) {
      console.log('♻️  Restaurando marcas desde respaldo...');
      try {
        const brandsBackup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));

        for (const brandData of brandsBackup) {
          // Verificar si la imagen existe
          if (brandData.image_url) {
            const imagePath = path.join(__dirname, '..', 'public', brandData.image_url);
            if (!fs.existsSync(imagePath)) {
              console.log(`⚠️  Imagen no encontrada: ${brandData.image_url}`);
              brandData.image_url = null;
            }
          }

          await Brand.create({
            code: brandData.code,
            name: brandData.name,
            description: brandData.description,
            image_url: brandData.image_url,
            status: brandData.status || 'active',
            created_by: adminUser.id
          });
        }

        console.log(`✅ ${brandsBackup.length} marcas restauradas\n`);
      } catch (error) {
        console.error('⚠️  Error al restaurar marcas:', error.message);
      }
    } else {
      console.log('ℹ️  No se encontró respaldo de marcas\n');
    }

    // Configuración de empresa
    console.log('🏢 Creando configuración de empresa...');
    await CompanySettings.findOrCreate({
      where: { id: 1 },
      defaults: { name: 'Mi Empresa' },
    });
    console.log('✅ Configuración de empresa creada\n');

    // Add database indexes for performance
    await addIndexes();

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Database initialized successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📝 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: Admin123!');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the admin password on first login!');
    console.log('='.repeat(60));
    console.log('');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = initializeDatabase;
