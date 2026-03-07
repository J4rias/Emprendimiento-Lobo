const { Product, Barcode, ProductPresentation, sequelize } = require('./models');
const { Op } = require('sequelize');

async function sanitizeProducts() {
    const t = await sequelize.transaction();
    try {
        console.log('--- INICIANDO SANEAMIENTO DE PRODUCTOS Y PRESENTACIONES ---\n');

        // 1. Desactivar productos sin código de barras
        console.log('1. Procesando productos sin código de barras...');
        const allProducts = await Product.findAll({
            include: [{ model: Barcode, as: 'barcodes' }],
            transaction: t
        });

        let deactivatedCount = 0;
        for (const product of allProducts) {
            if (!product.barcodes || product.barcodes.length === 0) {
                if (product.is_active) {
                    await product.update({ is_active: false }, { transaction: t });
                    deactivatedCount++;
                }
            }
        }
        console.log(`   > Se desactivaron ${deactivatedCount} productos sin código de barras.`);

        // 2. Asegurar presentación principal para productos con código de barras
        console.log('\n2. Asegurando presentación principal para productos con códigos de barras...');
        const productsWithBarcodes = await Product.findAll({
            include: [
                { model: Barcode, as: 'barcodes', required: true },
                { model: ProductPresentation, as: 'presentations' }
            ],
            transaction: t
        });

        let presentationsFixed = 0;
        let productsMissingPres = [];

        for (const product of productsWithBarcodes) {
            const hasDefault = product.presentations.some(p => p.is_default);

            if (!hasDefault) {
                if (product.presentations.length > 0) {
                    // Marcar la primera como default
                    await product.presentations[0].update({ is_default: true }, { transaction: t });
                    presentationsFixed++;
                } else {
                    // Caso extremo: Tiene código pero no tiene ninguna presentación
                    // Según el diagnóstico previo este caso es 0, pero lo manejamos por seguridad
                    productsMissingPres.push(product.id);
                }
            }
        }

        console.log(`   > Se asignó presentación principal a ${presentationsFixed} productos.`);
        if (productsMissingPres.length > 0) {
            console.warn(`   ! ADVERTENCIA: ${productsMissingPres.length} productos tienen código pero NO tienen ninguna presentación:`, productsMissingPres);
        }

        await t.commit();
        console.log('\n--- SANEAMIENTO COMPLETADO CON ÉXITO ---');
    } catch (err) {
        await t.rollback();
        console.error('\nERROR DURANTE EL PROCESO:', err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

sanitizeProducts();
