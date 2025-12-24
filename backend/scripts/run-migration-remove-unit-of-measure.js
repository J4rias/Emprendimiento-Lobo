const { sequelize } = require('../config/database');

async function runMigration() {
  try {
    console.log('Ejecutando migración: Eliminar unit_of_measure de products...');

    // Check if column exists first
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'unit_of_measure'
    `);

    if (results.length === 0) {
      console.log('✓ La columna unit_of_measure ya no existe en la tabla products');
      process.exit(0);
    }

    // Remove the column
    await sequelize.query('ALTER TABLE products DROP COLUMN unit_of_measure');

    console.log('✓ Migración completada exitosamente');
    console.log('✓ Columna unit_of_measure eliminada de la tabla products');

    process.exit(0);
  } catch (error) {
    console.error('✗ Error ejecutando la migración:', error);
    process.exit(1);
  }
}

runMigration();
