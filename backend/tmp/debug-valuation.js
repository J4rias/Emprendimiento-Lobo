const { Inventory, Product, ProductPresentation, ExchangeRate } = require('../models');
const { Op } = require('sequelize');

async function debugValuation() {
    try {
        const inventory = await Inventory.findAll({
            include: [{
                model: Product,
                as: 'product',
                include: [{ model: ProductPresentation, as: 'presentations' }]
            }]
        });

        const items = [];
        for (const inv of inventory) {
            const defaultPresentation = inv.product?.presentations?.find(p => p.is_default) || inv.product?.presentations?.[0];
            let cost = parseFloat(defaultPresentation?.cost || 0);
            const unitsPerPkg = parseInt(defaultPresentation?.units_per_package) || 1;
            const packageCost = parseFloat(defaultPresentation?.package_cost || 0);
            if (cost === 0 && packageCost > 0) {
                cost = packageCost / unitsPerPkg;
            }
            const currency = defaultPresentation?.purchase_currency || 'USD';
            const quantity = parseFloat(inv.quantity) || 0;
            const value = quantity * cost;

            items.push({
                name: inv.product?.name,
                quantity,
                cost,
                currency,
                value
            });
        }

        const topItems = items.sort((a, b) => b.value - a.value).slice(0, 5);
        console.log('Top Items by Valuation Value:');
        topItems.forEach(i => {
            console.log(`${i.name}: ${i.value.toFixed(2)} (${i.quantity} @ ${i.cost.toFixed(2)} ${i.currency})`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
}

debugValuation();
