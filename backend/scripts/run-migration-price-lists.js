/**
 * Migración: Crear tablas de listas de precios e inicializar listas base.
 *
 * Crea las tablas 'price_lists' y 'price_list_details' si no existen y agrega
 * las 3 listas predefinidas (Minorista, Mayorista, Distribuidor).
 *
 * Uso: node backend/scripts/run-migration-price-lists.js
 */
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function run() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('🔄 Iniciando migración de tablas para Listas de Precios...\n');

        // 1. Crear tabla price_lists si no existe
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
        console.log('✅ Tabla price_lists verificada/creada.');

        // 2. Crear tabla price_list_details si no existe
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
        console.log('✅ Tabla price_list_details verificada/creada.');

        // 3. Crear índices para optimizar búsquedas
        try {
            await queryInterface.addIndex('price_list_details', ['price_list_id', 'presentation_id'], {
                unique: true,
                name: 'unique_pricelist_presentation'
            });
        } catch (e) {
            console.log('ℹ️  El índice único ya existe.');
        }

        // 4. Crear Listas de Precios base si no existen
        const baseLists = [
            {
                code: 'LP-0001',
                name: 'Precio Público (Minorista)',
                description: 'Lista de precios estándar para venta al detal',
                currency: 'USD',
                base_percentage: 30,
                is_default: true,
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                code: 'LP-0002',
                name: 'Precio Mayorista',
                description: 'Lista para ventas por bulto/volumen',
                currency: 'USD',
                base_percentage: 20,
                is_default: false,
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                code: 'LP-0003',
                name: 'Precio Distribuidor',
                description: 'Lista para socios comerciales',
                currency: 'USD',
                base_percentage: 15,
                is_default: false,
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            }
        ];

        for (const list of baseLists) {
            const existing = await sequelize.query(
                `SELECT id FROM price_lists WHERE code = '${list.code}'`,
                { type: sequelize.QueryTypes.SELECT }
            );

            if (existing.length === 0) {
                await queryInterface.bulkInsert('price_lists', [list]);
                console.log(`✅ Creada lista base: ${list.name}`);
            }
        }

        console.log('\n🎉 Migración de tablas completada con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en la migración de tablas:', error);
        process.exit(1);
    }
}

run();
