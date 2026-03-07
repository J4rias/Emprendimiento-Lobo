const {
    Product,
    ProductPresentation,
    SaleDetail,
    InventoryMovement,
    Barcode,
    Inventory,
    PriceListDetail,
    QuoteDetail,
    PurchaseOrderDetail,
    TransferDetail,
    CreditNoteDetail,
    DeliveryDetail,
    sequelize
} = require('./models');
const { Op } = require('sequelize');

async function fixDuplicatePresentations() {
    const t = await sequelize.transaction();
    try {
        console.log('--- INICIANDO FUSIÓN DE PRESENTACIONES DUPLICADAS ---\n');

        // 1. Obtener todos los productos que tienen presentaciones con nombres duplicados
        const products = await Product.findAll({
            include: [{ model: ProductPresentation, as: 'presentations' }],
            transaction: t
        });

        for (const product of products) {
            const presentations = product.presentations || [];
            if (presentations.length < 2) continue;

            // Agrupar por nombre (normalizado a minúsculas y sin espacios extra)
            const groups = {};
            presentations.forEach(p => {
                const key = p.name.trim().toLowerCase();
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
            });

            for (const nameKey in groups) {
                const group = groups[nameKey];
                if (group.length < 2) continue;

                console.log(`> Producto: ${product.name} (ID: ${product.id}) - Duplicados encontrados para "${group[0].name}"`);

                // Identificar el "maestro" (preferir el default o el que tenga ID menor)
                let master = group.find(p => p.is_default) || group[0];
                const slaves = group.filter(p => p.id !== master.id);

                for (const slave of slaves) {
                    console.log(`   - Fusionando ID: ${slave.id} en ID: ${master.id} (Master)`);

                    // A. Mapear referencias externas

                    // SaleDetail
                    await SaleDetail.update({ presentation_id: master.id }, { where: { presentation_id: slave.id }, transaction: t });

                    // InventoryMovement
                    await InventoryMovement.update({ presentation_id: master.id }, { where: { presentation_id: slave.id }, transaction: t });

                    // Barcode (Handle Unique Conflicts)
                    const slaveBarcodes = await Barcode.findAll({ where: { presentation_id: slave.id }, transaction: t });
                    for (const sb of slaveBarcodes) {
                        try {
                            await sb.update({ presentation_id: master.id }, { transaction: t });
                        } catch (e) {
                            console.log(`     ! Barcode ${sb.barcode} ya existe en master. Eliminando duplicado.`);
                            await sb.destroy({ transaction: t });
                        }
                    }

                    // PriceListDetail (Handle Unique Conflicts)
                    const slavePrices = await PriceListDetail.findAll({ where: { presentation_id: slave.id }, transaction: t });
                    for (const sp of slavePrices) {
                        try {
                            const masterPrice = await PriceListDetail.findOne({
                                where: {
                                    price_list_id: sp.price_list_id,
                                    presentation_id: master.id
                                },
                                transaction: t
                            });

                            if (masterPrice) {
                                console.log(`     ! Registro en lista de precios #${sp.price_list_id} ya existe para master. Eliminando duplicado.`);
                                await sp.destroy({ transaction: t });
                            } else {
                                await sp.update({ presentation_id: master.id }, { transaction: t });
                            }
                        } catch (e) {
                            console.log(`     ! Error procesando precio en lista #${sp.price_list_id}. Eliminando por seguridad.`);
                            await sp.destroy({ transaction: t });
                        }
                    }

                    // QuoteDetail
                    await QuoteDetail.update({ productPresentationId: master.id }, { where: { productPresentationId: slave.id }, transaction: t });

                    // PurchaseOrderDetail
                    await PurchaseOrderDetail.update({ presentation_id: master.id }, { where: { presentation_id: slave.id }, transaction: t });

                    // TransferDetail
                    await TransferDetail.update({ presentation_id: master.id }, { where: { presentation_id: slave.id }, transaction: t });

                    // CreditNoteDetail
                    await CreditNoteDetail.update({ presentation_id: master.id }, { where: { presentation_id: slave.id }, transaction: t });

                    // DeliveryDetail
                    await DeliveryDetail.update({ presentation_id: master.id }, { where: { presentation_id: slave.id }, transaction: t });

                    // C. Eliminar la presentación duplicada
                    await slave.destroy({ transaction: t });
                }
            }
        }

        await t.commit();
        console.log('\n--- FUSIÓN COMPLETADA CON ÉXITO ---');
    } catch (err) {
        await t.rollback();
        console.error('\nERROR DURANTE EL PROCESO:', err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

fixDuplicatePresentations();
