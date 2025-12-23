const { sequelize } = require('../config/database');
const Supplier = require('../models/Supplier');
const SupplierContact = require('../models/SupplierContact');

async function migrateSupplierContacts() {
  try {
    console.log('Iniciando migración de contactos de proveedores...');
    
    // Obtener todos los proveedores que tienen contact_person
    const suppliers = await Supplier.findAll({
      where: {
        contact_person: {
          [sequelize.Sequelize.Op.ne]: null
        }
      }
    });

    console.log(`Encontrados ${suppliers.length} proveedores con contacto principal`);

    // Crear registros de contacto para cada proveedor
    for (const supplier of suppliers) {
      await SupplierContact.create({
        supplier_id: supplier.id,
        name: supplier.contact_person,
        position: null,
        email: supplier.email || null,
        phone: supplier.phone || null,
        mobile: supplier.mobile || null,
        is_primary: true,
        notes: null,
        is_active: true,
        created_by: supplier.created_by,
        updated_by: supplier.updated_by
      });
      
      console.log(`Contacto migrado para proveedor: ${supplier.name}`);
    }

    console.log('Migración completada exitosamente');
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  migrateSupplierContacts();
}

module.exports = migrateSupplierContacts;
