const { sequelize } = require('./backend/config/database');
const { Barcode, Product } = require('./backend/models');
const { Op } = require('sequelize');

async function findDuplicateBarcodes() {
    try {
        console.log('Searching for duplicate barcodes...');

        const duplicates = await Barcode.findAll({
            attributes: ['barcode', [sequelize.fn('COUNT', sequelize.col('barcode')), 'count']],
            group: ['barcode'],
            having: sequelize.where(sequelize.fn('COUNT', sequelize.col('barcode')), '>', 1)
        });

        if (duplicates.length === 0) {
            console.log('No duplicate barcodes found.');
        } else {
            console.log(`Found ${duplicates.length} duplicate barcode strings:`);
            for (const dup of duplicates) {
                const barcode = dup.barcode;
                const count = dup.get('count');
                console.log(`\nBarcode: ${barcode} (${count} occurrences)`);

                const records = await Barcode.findAll({
                    where: { barcode },
                    include: [{ model: Product, as: 'product', attributes: ['name', 'sku'] }]
                });

                records.forEach(r => {
                    console.log(`  - Product: ${r.product?.name} (SKU: ${r.product?.sku}), ID: ${r.id}, Active: ${r.is_active}`);
                });
            }
        }

        // Also check for barcodes that might be different but refer to same product/presentation in a weird way?
        // Actually, the main concern is usually the same barcode string on different products.

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

findDuplicateBarcodes();
