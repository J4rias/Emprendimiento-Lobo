const { ProductPresentation } = require('../models');
const { sequelize } = require('../config/database');

async function fixUnitCostsSync() {
    try {
        await sequelize.authenticate();
        console.log('Conectado a la base de datos.\n');

        const presentations = await ProductPresentation.findAll();
        let fixed = 0;

        for (const p of presentations) {
            const units = parseInt(p.units_per_package) || 1;
            const pkgCost = parseFloat(p.package_cost) || 0;
            const pkgPrice = parseFloat(p.package_price) || 0;
            const currentCost = parseFloat(p.cost) || 0;
            const currentBasePrice = parseFloat(p.base_price) || 0;

            const expectedCost = pkgCost / units;
            const expectedBasePrice = pkgPrice / units;

            // Comparar con tolerancia de 0.01 para decimales
            const costMismatch = Math.abs(currentCost - expectedCost) > 0.01;
            const priceMismatch = Math.abs(currentBasePrice - expectedBasePrice) > 0.01;

            if (costMismatch || priceMismatch) {
                console.log(`[${p.id}] ${p.name}: Costo ${currentCost} -> ${expectedCost.toFixed(2)}, Precio ${currentBasePrice} -> ${expectedBasePrice.toFixed(2)}`);
                await p.update({
                    cost: expectedCost,
                    base_price: expectedBasePrice
                });
                fixed++;
            }
        }

        console.log(`\nCorregidas ${fixed} de ${presentations.length} presentaciones.`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

fixUnitCostsSync();
