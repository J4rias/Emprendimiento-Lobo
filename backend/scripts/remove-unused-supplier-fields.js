const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function removeUnusedSupplierFields() {
  try {
    console.log('Eliminando campos no usados de la tabla suppliers...');
    
    // Obtener información de la tabla (MySQL syntax)
    const tableInfo = await sequelize.query(
      `DESCRIBE suppliers`,
      { type: QueryTypes.SELECT }
    );
    
    const existingColumns = tableInfo.map(col => col.Field);
    console.log('Columnas existentes:', existingColumns);
    
    // Campos a eliminar
    const fieldsToRemove = [
      'contact_person',
      'email', 
      'phone',
      'mobile',
      'address',
      'city',
      'state',
      'country'
    ];
    
    // Eliminar solo los campos que existen
    for (const field of fieldsToRemove) {
      if (existingColumns.includes(field)) {
        console.log(`Eliminando campo: ${field}`);
        await sequelize.query(
          `ALTER TABLE suppliers DROP COLUMN ${field}`,
          { type: QueryTypes.RAW }
        );
        console.log(`✓ Campo ${field} eliminado`);
      } else {
        console.log(`- Campo ${field} no existe, omitiendo`);
      }
    }
    
    console.log('\n✅ Campos no usados eliminados exitosamente');
  } catch (error) {
    console.error('Error al eliminar campos:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  removeUnusedSupplierFields();
}

module.exports = removeUnusedSupplierFields;
