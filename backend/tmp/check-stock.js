const { Inventory, Product } = require('../models');

async function checkStock() {
    try {
        const inventory = await Inventory.findAll({
            include: [{ model: Product, as: 'product' }],
            order: [['quantity', 'DESC']]
        });

        console.log('Product ID | Product Name | SKU | Quantity');
        console.log('-----------|--------------|-----|---------');
        inventory.forEach(inv => {
            console.log(`${String(inv.product_id).padEnd(10)} | ${String(inv.product?.name).padEnd(20)} | ${String(inv.product?.sku).padEnd(10)} | ${inv.quantity}`);
        });
    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
}

checkStock();
