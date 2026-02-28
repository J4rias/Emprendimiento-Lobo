const { Inventory, Product, ProductPresentation, ExchangeRate } = require('./models');
const { Op } = require('sequelize');

async function test() {
    try {
        const inventories = await Inventory.findAll({
            where: { quantity: { [Op.gt]: 0 } },
            attributes: ['product_id'],
            include: [
                {
                    model: Product,
                    as: 'product',
                    where: { is_active: true },
                    attributes: ['id', 'sku', 'name']
                }
            ],
            group: ['product_id']
        });

        console.log('Inventories found (products with stock):', inventories.length);

        for (const inv of inventories) {
            console.log(`Product ID: ${inv.product_id}, Name: ${inv.product?.name}`);
            const presentations = await ProductPresentation.findAll({
                where: {
                    product_id: inv.product_id,
                    is_active: true
                }
            });
            console.log(`  Presentations found: ${presentations.length}`);
        }

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        process.exit();
    }
}

test();
