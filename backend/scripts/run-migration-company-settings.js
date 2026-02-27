/**
 * Migración: Crear tabla company_settings e insertar fila default.
 *
 * Seguro para ejecutar múltiples veces (verifica si la tabla ya existe).
 *
 * Uso: node backend/scripts/run-migration-company-settings.js
 */
const { sequelize } = require('../config/database');
const Sequelize = require('sequelize');

async function run() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    // Verificar si la tabla ya existe
    const tables = await queryInterface.showAllTables();
    if (tables.includes('company_settings')) {
      console.log('ℹ️  La tabla company_settings ya existe. Nada que hacer.');
      process.exit(0);
    }

    console.log('Ejecutando migración: create-company-settings...');
    const migration = require('../migrations/20260223000005-create-company-settings');
    await migration.up(queryInterface, Sequelize);
    console.log('✅ Tabla company_settings creada con fila default.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

run();
