const { sequelize } = require('../config/database');
const Sequelize = require('sequelize');

async function runMigration() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Iniciando migración: remove-pen-from-currency-enums...');
    const migration = require('../migrations/20260223000004-remove-pen-from-currency-enums');
    await migration.up(queryInterface, Sequelize);
    console.log('✅ Migración completada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migración fallida:', error);
    process.exit(1);
  }
}

runMigration();
