const { sequelize } = require('../config/database');
const Sequelize = require('sequelize');

async function runMigration() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Starting migration: update-products-structure...');

    // Import the migration
    const migration = require('../migrations/20251223042913-update-products-structure');

    // Run the up migration
    await migration.up(queryInterface, Sequelize);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
