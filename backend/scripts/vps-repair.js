const { sequelize } = require('../config/database');
const { Inventory, Product, ProductPresentation, PriceListDetail, Customer } = require('../models');
const { Op } = require('sequelize');
require('dotenv').config();

async function runFinalRepair() {
    try {
        console.log('🚀 Iniciando REPARACIÓN DE DATOS (Preservando Stock Real)...');
        await sequelize.authenticate();
        console.log('✅ Conexión establecida a: ' + sequelize.config.database);

        // 🟢 1. REPARACIÓN DE CLIENTES (Venezuela)
        console.log('\n--- Reparando Clientes ---');
        await sequelize.query("ALTER TABLE customers MODIFY COLUMN document_type ENUM('DNI', 'RUC', 'CE', 'PASSPORT', 'OTHER', 'V', 'E', 'J', 'G', 'P', '') NOT NULL DEFAULT 'V'");
        await sequelize.query("UPDATE customers SET document_type = 'V' WHERE document_type IN ('DNI', 'OTHER', '') OR document_type IS NULL");
        await sequelize.query("UPDATE customers SET document_type = 'J' WHERE document_type = 'RUC'");
        await sequelize.query("UPDATE customers SET document_type = 'E' WHERE document_type = 'CE'");
        await sequelize.query("UPDATE customers SET document_type = 'P' WHERE document_type = 'PASSPORT'");
        await sequelize.query("ALTER TABLE customers MODIFY COLUMN document_type ENUM('V', 'E', 'J', 'G', 'P') NOT NULL DEFAULT 'V'");
        await sequelize.query("UPDATE customers SET country = 'Venezuela' WHERE country = 'Perú' OR country IS NULL");
        console.log('✅ Clientes migrados a estándar venezolano.');


        // 🟢 2. REPARACIÓN DE VALORACIÓN (Error de Divisa)
        console.log('\n--- Reparando Valoración del Inventario ---');
        // Detectar productos que tienen costos de MILES pero marcados en USD (Error de importación)
        // Estos deberían estar en COP para que la conversión sea real ($1.1M -> $280 aprox)
        const [costFix] = await sequelize.query(`
            UPDATE product_presentations 
            SET purchase_currency = 'COP' 
            WHERE package_cost > 1000 AND purchase_currency = 'USD'
        `);
        console.log(`✅ Corregida divisa en ${costFix.changedRows || 'varios'} presentaciones de productos.`);


        // 🟢 3. LIMPIEZA DE LISTAS DE PRECIOS
        console.log('\n--- Limpiando Listas de Precios (Sincronizando con Stock Real) ---');
        // El usuario quiere que productos SIN STOCK no aparezcan en los perfiles.
        // Vamos a eliminar los detalles de listas de precios de productos cuya cantidad total sea 0.

        const [plClean] = await sequelize.query(`
            DELETE FROM price_list_details 
            WHERE product_id IN (
                SELECT product_id FROM (
                    SELECT p.id as product_id, COALESCE(SUM(i.quantity), 0) as total_qty
                    FROM products p
                    LEFT JOIN inventory i ON p.id = i.product_id
                    GROUP BY p.id
                    HAVING total_qty <= 0
                ) as empty_products
            )
        `);
        console.log(`✅ Removidos ${plClean.affectedRows || 'varios'} items sin stock de los perfiles de listas de precios.`);


        // 🟢 4. VERIFICACIÓN FINAL
        const [stats] = await sequelize.query('SELECT COUNT(*) as count, SUM(quantity) as stock FROM inventory WHERE quantity > 0');
        console.log('\n--- ESTADO FINAL ---');
        console.log(`- Productos con Stock Preservados: ${stats[0].count}`);
        console.log(`- Cantidad Total de Unidades: ${stats[0].stock}`);

        console.log('\n🎉 REPARACIÓN VPS FINALIZADA EXITOSAMENTE 🎉');
        console.log('Los datos han sido corregidos sin eliminar el stock cargado por el usuario.');

    } catch (error) {
        console.error('\n❌ ERROR CRÍTICO:', error);
    } finally {
        process.exit(0);
    }
}

runFinalRepair();
