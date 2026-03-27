/**
 * Migration: Increase precision of credit_notes totals + add exchange_rate
 * Fixes: total stored as DECIMAL(12,2) causing COP rounding errors on devolutions
 */
const { sequelize } = require('../config/database');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Check if exchange_rate column already exists
    const [cols] = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_notes' AND COLUMN_NAME = 'exchange_rate'`
    );
    if (cols.length === 0) {
      await sequelize.query(
        `ALTER TABLE credit_notes
         ADD COLUMN exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1.000000
         COMMENT 'Tasa de cambio USD→COP copiada de la venta'`
      );
      console.log('✅ Added exchange_rate column');
    } else {
      console.log('ℹ️  exchange_rate column already exists, skipping');
    }

    const modifyQueries = [
      `ALTER TABLE credit_notes MODIFY COLUMN subtotal DECIMAL(18,6) NOT NULL DEFAULT 0.000000`,
      `ALTER TABLE credit_notes MODIFY COLUMN tax_amount DECIMAL(18,6) NOT NULL DEFAULT 0.000000`,
      `ALTER TABLE credit_notes MODIFY COLUMN total DECIMAL(18,6) NOT NULL DEFAULT 0.000000`,
      `ALTER TABLE credit_notes MODIFY COLUMN refund_amount DECIMAL(18,6) NOT NULL DEFAULT 0.000000`,
    ];

    for (const q of modifyQueries) {
      await sequelize.query(q);
      console.log('✅', q.trim());
    }

    // Back-fill exchange_rate from the related sale for existing notes
    await sequelize.query(`
      UPDATE credit_notes cn
      JOIN sales s ON s.id = cn.sale_id
      SET cn.exchange_rate = s.exchange_rate
      WHERE cn.exchange_rate = 1
    `);
    console.log('✅ Back-filled exchange_rate from sales');

    console.log('\n✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

run();
