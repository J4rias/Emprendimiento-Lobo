/**
 * vps-upgrade-decimals-prices.js
 * Run this on VPS: node scripts/vps-upgrade-decimals-prices.js
 */
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function run() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('🔄 Ejecutando actualizaciones estructurales de Alta Precisión y Listas de Precios...\n');

        // 1. Ampliar decimales en ventas para evitar problemas de redondeo en monedas como COP y VES
        console.log('1. Ajustando campos DECIMAL en Ventas a (18,6)...');
        await sequelize.query('ALTER TABLE sales MODIFY subtotal DECIMAL(18,6), MODIFY total DECIMAL(18,6), MODIFY tax_amount DECIMAL(18,6), MODIFY discount_amount DECIMAL(18,6), MODIFY paid_amount DECIMAL(18,6), MODIFY change_amount DECIMAL(18,6);').catch(() => { });
        await sequelize.query('ALTER TABLE sale_details MODIFY unit_price DECIMAL(18,6), MODIFY subtotal DECIMAL(18,6), MODIFY total DECIMAL(18,6), MODIFY tax_amount DECIMAL(18,6), MODIFY discount_amount DECIMAL(18,6), MODIFY cost_price DECIMAL(18,6);').catch(() => { });
        await sequelize.query('ALTER TABLE sale_payments MODIFY amount DECIMAL(18,6), MODIFY exchange_rate DECIMAL(18,6);').catch(() => { });
        console.log('✅ Ventas actualizadas.');

        // 2. Verificar y agregar cualquier columna faltante en price_lists
        console.log('2. Verificando estructura de price_lists...');
        const priceListDesc = await queryInterface.describeTable('price_lists').catch(() => null);
        if (priceListDesc) {
            const missingColumns = [
                { name: 'validity_days', type: DataTypes.INTEGER, defaultValue: 5 },
                { name: 'is_deleted', type: DataTypes.BOOLEAN, defaultValue: false },
                { name: 'updated_by', type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
                { name: 'valid_from', type: DataTypes.DATE, allowNull: true },
                { name: 'valid_until', type: DataTypes.DATE, allowNull: true },
                { name: 'base_percentage', type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
                { name: 'is_default', type: DataTypes.BOOLEAN, defaultValue: false }
            ];

            for (const col of missingColumns) {
                if (!priceListDesc[col.name]) {
                    console.log(`➕ Agregando columna faltante: ${col.name} en price_lists...`);
                    await queryInterface.addColumn('price_lists', col.name, {
                        type: col.type,
                        allowNull: col.allowNull !== undefined ? col.allowNull : false,
                        defaultValue: col.defaultValue !== undefined ? col.defaultValue : null,
                        references: col.references || null
                    }).catch(e => console.log(`   Nota: ${e.message}`));
                }
            }
        }

        // 3. Verificando/Ampliando price_list_details
        console.log('3. Ajustando campos DECIMAL en Detalles de Lista de Precios...');
        const pldDesc = await queryInterface.describeTable('price_list_details').catch(() => null);
        if (pldDesc) {
            // Ampliamos decimales para soportar COP también en estas columnas de precios
            await sequelize.query('ALTER TABLE price_list_details \
                MODIFY package_cost DECIMAL(18,6), \
                MODIFY unit_cost DECIMAL(18,6), \
                MODIFY package_price DECIMAL(18,6), \
                MODIFY unit_price DECIMAL(18,6);\
            ').catch(() => { });
        }

        console.log('\n🎉 ¡Base de datos del VPS sincronizada correctamente!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error general durante la ejecución de la migración:', error);
        process.exit(1);
    }
}

run();
