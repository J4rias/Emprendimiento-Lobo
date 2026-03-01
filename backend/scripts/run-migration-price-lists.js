/**
 * Migración: Crear/Actualizar tablas de listas de precios.
 *
 * Versión corregida: Asegura que TODAS las columnas (incluyendo validity_days e is_deleted)
 * existan en las tablas para evitar errores 'Unknown column'.
 *
 * Uso: node backend/scripts/run-migration-price-lists.js
 */
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function run() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('🔄 Sincronizando estructura de Listas de Precios...\n');

        // 1. Crear tabla price_lists si no existe con toda la estructura
        await queryInterface.createTable('price_lists', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            code: {
                type: DataTypes.STRING(20),
                unique: true,
                allowNull: false
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            currency: {
                type: DataTypes.ENUM('USD', 'COP', 'VES'),
                allowNull: false,
                defaultValue: 'USD'
            },
            base_percentage: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0
            },
            is_default: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            status: {
                type: DataTypes.ENUM('active', 'inactive'),
                allowNull: false,
                defaultValue: 'active'
            },
            validity_days: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 5
            },
            valid_from: {
                type: DataTypes.DATE,
                allowNull: true
            },
            valid_until: {
                type: DataTypes.DATE,
                allowNull: true
            },
            is_deleted: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            updated_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' }
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        // 2. Por si la tabla ya existía pero le faltaban columnas (corrección manual de columnas críticas)
        const tableDesc = await queryInterface.describeTable('price_lists');

        if (!tableDesc.validity_days) {
            await queryInterface.addColumn('price_lists', 'validity_days', {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 5
            });
            console.log('✅ Agregada columna validity_days a price_lists');
        }

        if (!tableDesc.is_deleted) {
            await queryInterface.addColumn('price_lists', 'is_deleted', {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            });
            console.log('✅ Agregada columna is_deleted a price_lists');
        }

        // 3. Crear tabla price_list_details
        await queryInterface.createTable('price_list_details', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            price_list_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'price_lists', key: 'id' },
                onDelete: 'CASCADE'
            },
            product_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'products', key: 'id' }
            },
            presentation_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'product_presentations', key: 'id' }
            },
            package_cost: {
                type: DataTypes.DECIMAL(18, 2),
                allowNull: false,
                defaultValue: 0
            },
            unit_cost: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0
            },
            package_price: {
                type: DataTypes.DECIMAL(18, 2),
                allowNull: false,
                defaultValue: 0
            },
            unit_price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0
            },
            margin_percentage: {
                type: DataTypes.DECIMAL(5, 1),
                allowNull: false,
                defaultValue: 0
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        console.log('✅ Estructura verificada/actualizada.');

        // Inicialización de listas base (LP-0001, etc) - Igual que antes
        const baseLists = [
            { code: 'LP-0001', name: 'Precio Público (Minorista)', currency: 'USD', base_percentage: 30, is_default: true, status: 'active', created_at: new Date(), updated_at: new Date() },
            { code: 'LP-0002', name: 'Precio Mayorista', currency: 'USD', base_percentage: 20, is_default: false, status: 'active', created_at: new Date(), updated_at: new Date() },
            { code: 'LP-0003', name: 'Precio Distribuidor', currency: 'USD', base_percentage: 15, is_default: false, status: 'active', created_at: new Date(), updated_at: new Date() }
        ];

        for (const list of baseLists) {
            const [existing] = await sequelize.query(`SELECT id FROM price_lists WHERE code = '${list.code}'`);
            if (existing.length === 0) {
                await queryInterface.bulkInsert('price_lists', [list]);
                console.log(`✅ Creada lista base: ${list.name}`);
            }
        }

        console.log('\n🎉 Proceso completado con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

run();
