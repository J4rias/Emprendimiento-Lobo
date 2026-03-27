/**
 * Migration: Make credit_notes.customer_id nullable
 * Fixes: "Column 'customer_id' cannot be null" when creating a credit note for Consumidor Final sales
 */
const { sequelize } = require('../config/database');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Check current nullability of customer_id
    const [cols] = await sequelize.query(
      `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_notes' AND COLUMN_NAME = 'customer_id'`
    );

    if (cols.length === 0) {
      console.error('❌ Column customer_id not found in credit_notes');
      return;
    }

    if (cols[0].IS_NULLABLE === 'YES') {
      console.log('ℹ️  customer_id is already nullable, skipping ALTER TABLE');
    } else {
      await sequelize.query(
        `ALTER TABLE credit_notes MODIFY COLUMN customer_id INT NULL COMMENT 'Cliente al que se emite la nota de crédito (NULL para Consumidor Final)'`
      );
      console.log('✅ customer_id is now nullable');
    }

    console.log('\n✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

run();
