const { InventoryMovement, Product, Inventory } = require('../models');

async function debugMovements() {
    try {
        const products = await Product.findAll({
            limit: 10,
            include: [{ model: Inventory, as: 'inventories' }]
        });

        for (const p of products) {
            const movements = await InventoryMovement.findAll({ where: { product_id: p.id } });
            const currentStock = p.inventories.reduce((acc, inv) => acc + parseFloat(inv.quantity), 0);
            console.log(`Product: ${p.name} (SKU: ${p.sku})`);
            console.log(`- Current Stock: ${currentStock}`);
            console.log(`- Movements: ${movements.length}`);
            movements.forEach(m => {
                console.log(`  - ${m.movement_type}: ${m.quantity} (${m.created_at})`);
            });
            console.log('---');
        }

    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
}

debugMovements();
