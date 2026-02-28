const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PriceListDetail = sequelize.define('PriceListDetail', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    price_list_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'price_lists',
            key: 'id'
        },
        comment: 'Lista de precios a la que pertenece'
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'products',
            key: 'id'
        }
    },
    presentation_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'product_presentations',
            key: 'id'
        }
    },
    package_cost: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Costo del paquete (snapshot del costo al momento de crear/actualizar)'
    },
    unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Costo unitario (package_cost / units_per_package)'
    },
    package_price: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Precio de venta por paquete'
    },
    unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Precio unitario (package_price / units_per_package)'
    },
    margin_percentage: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: false,
        defaultValue: 0,
        comment: 'Margen de ganancia con 1 decimal'
    }
}, {
    tableName: 'price_list_details',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['price_list_id']
        },
        {
            fields: ['product_id']
        },
        {
            fields: ['presentation_id']
        },
        {
            unique: true,
            fields: ['price_list_id', 'presentation_id'],
            name: 'unique_pricelist_presentation'
        }
    ]
});

module.exports = PriceListDetail;
