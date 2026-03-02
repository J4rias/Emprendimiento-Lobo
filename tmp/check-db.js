const { Sequelize } = require('sequelize');
async function check() {
    const s = new Sequelize('inversiones_db', 'root', 'w9ET03.Hk_', { host: 'localhost', dialect: 'mysql' });
    const [r] = await s.query('DESCRIBE customers');
    console.log('Customer type in inversiones_db:', r.find(f => f.Field === 'document_type').Type);

    const [inv] = await s.query('SELECT SUM(quantity) as sum FROM inventory');
    console.log('Total Stock Quantity in inversiones_db:', inv[0].sum);

    const [mv] = await s.query('SELECT reason, count(*) as count FROM inventory_movements GROUP BY reason');
    console.log('Movements in inversiones_db:', mv);
}
check();
