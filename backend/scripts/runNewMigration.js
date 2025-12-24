const { sequelize } = require('../config/database');
const Sequelize = require('sequelize');

async function runMigration() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Starting migration: add-image-and-purchase-currency...');

    // Import the migration
    const migration = require('../migrations/20251223044615-add-image-and-purchase-currency');

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
