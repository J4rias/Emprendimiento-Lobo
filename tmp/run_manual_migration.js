const { sequelize } = require('../backend/config/database');
const migration = require('../backend/migrations/20260313062000-add-frozen-fields-to-price-list-details.js');
const { QueryInterface, Sequelize } = require('sequelize');

async function runMigration() {
  const queryInterface = sequelize.getQueryInterface();
  const migrationName = '20260313062000-add-frozen-fields-to-price-list-details.js';

  try {
    console.log(`Starting migration: ${migrationName}`);
    
    // Check if columns already exist (to avoid errors if partially run)
    const tableInfo = await queryInterface.describeTable('price_list_details');
    if (tableInfo.is_frozen) {
      console.log('Columns already exist. Skipping migration up.');
    } else {
      await migration.up(queryInterface, Sequelize);
      console.log('Migration up completed successfully.');
    }

    // Mark as completed in SequelizeMeta
    await sequelize.query(
      'INSERT INTO SequelizeMeta (name) VALUES (:name) ON DUPLICATE KEY UPDATE name = VALUES(name)',
      {
        replacements: { name: migrationName },
        type: sequelize.QueryTypes.INSERT
      }
    );
    console.log(`Migration ${migrationName} marked as completed in SequelizeMeta.`);

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
