const { Product, sequelize } = require('../models');

async function checkDuplicates() {
    try {
        const [results] = await sequelize.query(`
      SELECT name, COUNT(*) as count, GROUP_CONCAT(id) as ids 
      FROM products 
      GROUP BY name 
      HAVING count > 1
    `);

        console.log(`Duplicate Names: ${results.length}`);
        results.forEach(row => {
            console.log(`${row.name}: ${row.count} (IDs: ${row.ids})`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
}

checkDuplicates();
