/**
 * Migración: Vincular productos actuales a la nueva Lista de Precios.
 *
 * Versión 2: Robustez mejorada. Verifica integridad referencial antes de insertar
 * para evitar errores de Foreign Key si existen datos huérfanos.
 *
 * Uso: node backend/scripts/migrate-existing-prices.js
 */
const { sequelize } = require('../config/database');
const { PriceList, PriceListDetail, ProductPresentation, Product } = require('../models');

async function run() {
    try {
        console.log('🔄 Iniciando migración de precios existentes...\n');

        // 1. Buscar la lista de precios por defecto (Minorista)
        const retailList = await PriceList.findOne({ where: { code: 'LP-0001' } });

        if (!retailList) {
            console.error('❌ Error: No se encontró la lista base LP-0001. Ejecuta primero run-migration-price-lists.js');
            process.exit(1);
        }

        // 2. Obtener todas las presentaciones de productos
        const presentations = await ProductPresentation.findAll({
            include: [{ model: Product, as: 'product' }]
        });
        console.log(`📊 Procesando ${presentations.length} presentaciones...`);

        let migrated = 0;
        let skipped = 0;
        let orphaned = 0;

        for (const pres of presentations) {
            // Verificar integridad referencial (que el producto realmente exista)
            if (!pres.product) {
                orphaned++;
                continue;
            }

            // Verificar si ya tiene precio asignado en esta lista
            const existingDetail = await PriceListDetail.findOne({
                where: {
                    price_list_id: retailList.id,
                    presentation_id: pres.id
                }
            });

            if (!existingDetail) {
                try {
                    const cost = parseFloat(pres.package_cost || 0);
                    const price = parseFloat(pres.package_price || 0);
                    const units = parseInt(pres.units_per_package || 1);

                    let margin = 0;
                    if (cost > 0) {
                        margin = ((price - cost) / cost) * 100;
                    }

                    await PriceListDetail.create({
                        price_list_id: retailList.id,
                        product_id: pres.product_id,
                        presentation_id: pres.id,
                        package_cost: cost,
                        unit_cost: cost / units,
                        package_price: price,
                        unit_price: price / units,
                        margin_percentage: margin.toFixed(1),
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    migrated++;
                } catch (innerError) {
                    console.warn(`⚠️  Saltando presentación ID ${pres.id} por error de integridad.`);
                    skipped++;
                }
            } else {
                skipped++;
            }
        }

        console.log(`\n✅ Migración finalizada.`);
        console.log(`✨ Precios migrados: ${migrated}`);
        console.log(`⏭️  Productos ya vinculados o saltados: ${skipped}`);
        if (orphaned > 0) {
            console.log(`🗑️  Registros huérfanos ignorados: ${orphaned}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error general migrando precios:', error);
        process.exit(1);
    }
}

run();
