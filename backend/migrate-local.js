const fs = require('fs');
const path = require('path');
const { sequelize } = require('./config/database');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'scripts', 'migrations', 'add_exchange_rate_to_sales.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split the SQL into individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('-- ')); // Filter out empty lines and full line comments

        for (const statement of statements) {
            if (!statement) continue;
            console.log('Executing:', statement.substring(0, 50) + '...');
            try {
                await sequelize.query(statement);
            } catch (err) {
                // Ignore "Duplicate column name" error if it's already there
                if (err.parent && err.parent.code === 'ER_DUP_FIELDNAME') {
                    console.log('Column already exists, skipping ADD COLUMN.');
                } else {
                    throw err;
                }
            }
        }
        console.log('Migration completed successfully locally.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

runMigration();
