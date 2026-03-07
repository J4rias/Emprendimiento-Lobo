const { Product, Barcode, Inventory, sequelize } = require('./models');
const { Op } = require('sequelize');

async function executeCleanup() {
    const t = await sequelize.transaction();
    const report = [];

    try {
        console.log('--- INICIANDO PROCESO DE LIMPIEZA Y FUSIÓN ---\n');

        // 1. Liberar códigos de barras inactivos
        const inactiveBarcodes = await Barcode.findAll({ where: { is_active: false }, transaction: t });
        console.log(`> Liberando ${inactiveBarcodes.length} códigos de barras inactivos...`);
        for (const b of inactiveBarcodes) {
            if (!b.barcode.startsWith('OLD_')) {
                const oldBarcode = b.barcode;
                const newBarcode = `OLD_${Date.now()}_${oldBarcode}`.substring(0, 100);
                await b.update({ barcode: newBarcode }, { transaction: t });
                report.push({ id: b.product_id, type: 'BARCODE_RELEASE', original: oldBarcode, modified: newBarcode });
            }
        }

        // 2. Fusión de Productos Duplicados (Stock + Desactivación)
        // Casos conocidos:
        // A. Crema de Arroz Mary (57 -> 601)
        // B. Vinagre Heinz (649 -> 526)

        const merges = [
            { from: 57, to: 601, name: "Crema de Arroz Mary, 450 gr" },
            { from: 649, to: 526, name: "Vinagre Heinz" }
        ];

        for (const m of merges) {
            console.log(`> Fusionando producto ID:${m.from} en ID:${m.to} (${m.name})...`);

            // Buscar inventarios del producto origen
            const sourceInventories = await Inventory.findAll({ where: { product_id: m.from }, transaction: t });

            for (const sInv of sourceInventories) {
                if (sInv.quantity > 0) {
                    // Buscar si el destino ya tiene registro en ese almacén
                    const destInv = await Inventory.findOne({
                        where: { product_id: m.to, warehouse_id: sInv.warehouse_id },
                        transaction: t
                    });

                    if (destInv) {
                        // Sumar cantidades
                        const newQty = parseFloat(destInv.quantity) + parseFloat(sInv.quantity);
                        const newAvail = parseFloat(destInv.available_quantity || 0) + parseFloat(sInv.available_quantity || 0);
                        await destInv.update({ quantity: newQty, available_quantity: newAvail }, { transaction: t });
                        await sInv.update({ quantity: 0, available_quantity: 0 }, { transaction: t });
                    } else {
                        // Mover el registro íntegro al nuevo ID (o crear uno nuevo)
                        await Inventory.create({
                            product_id: m.to,
                            warehouse_id: sInv.warehouse_id,
                            quantity: sInv.quantity,
                            available_quantity: sInv.available_quantity,
                            reserved_quantity: sInv.reserved_quantity,
                            last_count_date: sInv.last_count_date,
                            last_movement_date: sInv.last_movement_date
                        }, { transaction: t });
                        await sInv.update({ quantity: 0, available_quantity: 0 }, { transaction: t });
                    }
                }
            }

            // Desactivar el producto origen
            const prodFrom = await Product.findByPk(m.from, { transaction: t });
            if (prodFrom) {
                await prodFrom.update({ is_active: false, name: `[DUPLICADO] ${prodFrom.name}` }, { transaction: t });
                // Desactivar sus códigos de barras (si tuviera)
                await Barcode.update({ is_active: false }, { where: { product_id: m.from }, transaction: t });
                report.push({ id: m.from, type: 'PRODUCT_MERGE', name: m.name, action: 'DEACTIVATED' });
            }
        }

        await t.commit();
        console.log('\n--- REPORTE FINAL DE EJECUCIÓN ---\n');
        console.table(report);

        // Formato solicitado por el usuario: ID, Nombre, Código modificado
        console.log('\nResumen Detallado:');
        for (const item of report) {
            if (item.type === 'BARCODE_RELEASE') {
                console.log(`ID: ${item.id} | Acción: Liberación de Código | Original: ${item.original} -> Nuevo: ${item.modified}`);
            } else {
                console.log(`ID: ${item.id} | Acción: Fusión/Desactivación | Producto: ${item.name}`);
            }
        }

    } catch (err) {
        await t.rollback();
        console.error('Error durante la ejecución:', err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

executeCleanup();
