const { Product, ProductPresentation } = require('../models');

async function test() {
    const pres = await ProductPresentation.findAll({
        include: [{ model: Product, as: 'product' }],
        limit: 5,
        order: [['sale_price', 'DESC']]
    });
    console.log(JSON.stringify(pres, null, 2));
    process.exit(0);
}
test();
