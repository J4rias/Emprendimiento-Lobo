const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function run() {
    try {
        console.log('🔄 Iniciando migración de SalePayments...');

        const queryInterface = sequelize.getQueryInterface();

        // Verificar si la columna currency ya existe
        const tableInfo = await queryInterface.describeTable('sale_payments');

        if (!tableInfo.currency) {
            console.log('➕ Agregando columna currency...');
            await queryInterface.addColumn('sale_payments', 'currency', {
                type: DataTypes.ENUM('USD', 'COP', 'VES'),
                allowNull: false,
                defaultValue: 'USD',
                comment: 'Moneda originaria del pago'
            });
        } else {
            console.log('ℹ️  La columna currency ya existe.');
        }

        if (!tableInfo.exchange_rate) {
            console.log('➕ Agregando columna exchange_rate...');
            await queryInterface.addColumn('sale_payments', 'exchange_rate', {
                type: DataTypes.DECIMAL(15, 4),
                allowNull: false,
                defaultValue: 1.0000,
                comment: 'Tasa de conversión a USD al momento del pago'
            });
        } else {
            console.log('ℹ️  La columna exchange_rate ya existe.');
        }

        console.log('✅ Migración de SalePayments completada.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error migrando SalePayments:', error);
        process.exit(1);
    }
}

run();
