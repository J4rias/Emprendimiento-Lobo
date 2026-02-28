const { ProductPresentation } = require('../models');
const { sequelize } = require('../config/database');

async function fixCosts() {
    try {
        await sequelize.authenticate();
        console.log('Conectado a la base de datos.');

        const presentations = await ProductPresentation.findAll({
            where: {
                cost: 0,
                package_cost: { [require('sequelize').Op.gt]: 0 }
            }
        });

        console.log(`Encontradas ${presentations.length} presentaciones con costo unitario en cero y costo por paquete válido.`);

        for (const p of presentations) {
            const unitsPerPkg = parseInt(p.units_per_package) || 1;
            const packageCost = parseFloat(p.package_cost) || 0;
            const packagePrice = parseFloat(p.package_price) || 0;

            const newCost = packageCost / unitsPerPkg;
            const newBasePrice = packagePrice / unitsPerPkg;

            console.log(`Corrigiendo [${p.id}] ${p.name}: Costo ${newCost.toFixed(2)}, Precio ${newBasePrice.toFixed(2)}`);

            await p.update({
                cost: newCost,
                base_price: newBasePrice
            });
        }

        console.log('Proceso de corrección finalizado con éxito.');
    } catch (error) {
        console.error('Error durante la corrección:', error);
    } finally {
        process.exit(0);
    }
}

fixCosts();
