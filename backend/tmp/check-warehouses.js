const { Inventory, Warehouse } = require('../models');

async function checkWarehouses() {
    try {
        const ws = await Warehouse.findAll();
        for (const w of ws) {
            const inv = await Inventory.findAll({ where: { warehouse_id: w.id } });
            const qty = inv.reduce((acc, i) => acc + parseFloat(i.quantity), 0);
            console.log(`Warehouse: ${w.name} (ID: ${w.id})`);
            console.log(`- Item count: ${inv.length}`);
            console.log(`- Total Qty: ${qty.toFixed(2)}`);
        }
    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
}

checkWarehouses();
