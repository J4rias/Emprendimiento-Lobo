const { Inventory, Product, Barcode } = require('../models');
const { Op } = require('sequelize');

async function testQuery() {
    const search = 'ACE'; // Try searching for Aceite
    const productWhere = {
        [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { sku: { [Op.like]: `%${search}%` } }
        ]
    };

    try {
        const { rows, count } = await Inventory.findAndCountAll({
            where: {},
            include: [
                {
                    model: Product,
                    as: 'product',
                    where: productWhere
                }
            ],
            limit: 10,
            offset: 0,
            distinct: true,
            subQuery: false
        });
        console.log('Count:', count);
        console.log('Results:', rows.length);
        if (rows.length > 0) {
            console.log('First Result Product SKU:', rows[0].product.sku);
        }
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}

testQuery();
