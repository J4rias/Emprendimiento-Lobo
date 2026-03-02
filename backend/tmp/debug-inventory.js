const { Inventory, Product } = require('../models');
const { Op } = require('sequelize');

async function debugInventory() {
    try {
        console.log('--- Debugging Inventory Valuation Issues ---');

        const inventory = await Inventory.findAll({
            include: [{ model: Product, as: 'product' }]
        });

        console.log(`Total inventory records: ${inventory.length}`);

        const positiveStock = inventory.filter(inv => parseFloat(inv.quantity) > 0);
        console.log(`Records with quantity > 0: ${positiveStock.length}`);

        const zeroStock = inventory.filter(inv => parseFloat(inv.quantity) === 0);
        console.log(`Records with quantity == 0: ${zeroStock.length}`);

        const negativeStock = inventory.filter(inv => parseFloat(inv.quantity) < 0);
        console.log(`Records with quantity < 0: ${negativeStock.length}`);

        if (negativeStock.length > 0) {
            console.log('WARNING: Found negative stock records!');
            negativeStock.forEach(inv => {
                console.log(`Product ID: ${inv.product_id}, Qty: ${inv.quantity}`);
            });
        }

        // Check for products in Price List but purportedly without stock
        // The user says they "appear in price list profiles"
        // Let's see if there are products with quantity > 0 but no "real" existence.

        console.log('\nTop 10 Inventory items with positive stock:');
        positiveStock.slice(0, 10).forEach(inv => {
            console.log(`- ${inv.product?.name} (ID: ${inv.product_id}): ${inv.quantity}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

debugInventory();
