/**
 * Corrige el inventario descontando las ventas del 16-Mar-2026 en adelante.
 * El conteo fisico fue el 15-Mar-2026, por lo tanto quantity ya refleja ese dia.
 *
 * Uso: node scripts/fix-inventory-from-sales.js
 */

const { sequelize } = require('../config/database');

async function run() {
    console.log('=== CORRECCION DE INVENTARIO (ventas desde 16-Mar-2026) ===\n');

    try {
        await sequelize.authenticate();
        console.log('Conexion exitosa.\n');

        // Ventas desde el dia despues del conteo fisico
        const SINCE = '2026-03-16 00:00:00';

        // 1. Unidades de ventas COMPLETADAS desde el 16 → deben restarse de quantity
        const [completedUnits] = await sequelize.query(`
            SELECT sd.product_id, s.warehouse_id,
                   SUM(
                     CASE WHEN sd.is_unit = 1 THEN sd.quantity
                          ELSE sd.quantity * COALESCE(pp.units_per_package, 1)
                     END
                   ) as units_sold
            FROM sale_details sd
            JOIN sales s ON s.id = sd.sale_id
            JOIN product_presentations pp ON pp.id = sd.presentation_id
            WHERE s.status = 'completed'
              AND s.sale_date >= ?
            GROUP BY sd.product_id, s.warehouse_id
        `, { replacements: [SINCE] });

        // 2. Unidades PENDIENTES (credito sin cobrar) desde el 16 → nuevo reserved_quantity
        const [pendingUnits] = await sequelize.query(`
            SELECT sd.product_id, s.warehouse_id,
                   SUM(
                     CASE WHEN sd.is_unit = 1 THEN sd.quantity
                          ELSE sd.quantity * COALESCE(pp.units_per_package, 1)
                     END
                   ) as units_pending
            FROM sale_details sd
            JOIN sales s ON s.id = sd.sale_id
            JOIN product_presentations pp ON pp.id = sd.presentation_id
            WHERE s.status = 'pending'
              AND s.sale_type = 'credit'
              AND s.sale_date >= ?
            GROUP BY sd.product_id, s.warehouse_id
        `, { replacements: [SINCE] });

        const completedMap = {};
        completedUnits.forEach(r => {
            completedMap[`${r.product_id}-${r.warehouse_id}`] = parseFloat(r.units_sold);
        });

        const pendingMap = {};
        pendingUnits.forEach(r => {
            pendingMap[`${r.product_id}-${r.warehouse_id}`] = parseFloat(r.units_pending);
        });

        // 3. Leer inventario actual
        const [currentState] = await sequelize.query(`
            SELECT i.id, i.product_id, i.warehouse_id,
                   p.name as producto,
                   i.quantity,
                   i.reserved_quantity
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            ORDER BY p.name
        `);

        console.log('--- APLICANDO CORRECCIONES ---');
        let corrected = 0;

        for (const inv of currentState) {
            const key = `${inv.product_id}-${inv.warehouse_id}`;
            const unitsSold = completedMap[key] || 0;
            const unitsPending = pendingMap[key] || 0;

            // quantity = conteo del 15 - ventas completadas desde el 16
            const newQuantity = parseFloat(inv.quantity) - unitsSold;
            const newReserved = unitsPending;

            const quantityChanged = Math.abs(newQuantity - parseFloat(inv.quantity)) > 0.001;
            const reservedChanged = Math.abs(newReserved - parseFloat(inv.reserved_quantity)) > 0.001;

            if (!quantityChanged && !reservedChanged) continue;

            console.log(`  ${inv.producto}:`);
            if (quantityChanged) {
                console.log(`    quantity:  ${inv.quantity}  ->  ${newQuantity}  (-${unitsSold} vendidas completadas)`);
            }
            if (reservedChanged) {
                console.log(`    reserved:  ${inv.reserved_quantity}  ->  ${newReserved}  (credito pendiente)`);
            }

            await sequelize.query(
                `UPDATE inventory SET quantity = ?, reserved_quantity = ? WHERE id = ?`,
                { replacements: [newQuantity, newReserved, inv.id] }
            );
            corrected++;
        }

        if (corrected === 0) {
            console.log('  Sin diferencias detectadas.');
        }

        // 4. Verificar si quedaron valores negativos
        const [negatives] = await sequelize.query(`
            SELECT p.name as producto,
                   i.quantity,
                   i.reserved_quantity,
                   (i.quantity - i.reserved_quantity) as available_virtual
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            WHERE i.quantity < 0 OR i.reserved_quantity < 0
            ORDER BY p.name
            LIMIT 20
        `);

        if (negatives.length > 0) {
            console.log('\n--- ADVERTENCIA: registros con valores negativos ---');
            negatives.forEach(r => {
                console.log(`  ${r.producto}: qty=${r.quantity} | reserved=${r.reserved_quantity} | disp=${r.available_virtual}`);
            });
        } else {
            console.log('\nTodos los registros tienen valores no-negativos.');
        }

        console.log(`\nRegistros corregidos: ${corrected}`);
        console.log('Listo.');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

run();
