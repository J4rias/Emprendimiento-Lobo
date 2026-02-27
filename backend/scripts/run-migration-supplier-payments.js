const { sequelize } = require('../config/database');
const Sequelize = require('sequelize');

async function runMigration() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Iniciando migración: add-fields-to-supplier-payments...');
    const migration = require('../migrations/20260223000002-add-fields-to-supplier-payments');
    await migration.up(queryInterface, Sequelize);
    console.log('✅ Migración completada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migración fallida:', error);
    process.exit(1);
  }
}

runMigration();
