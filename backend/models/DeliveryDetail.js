const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DeliveryDetail = sequelize.define('DeliveryDetail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  delivery_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'deliveries',
      key: 'id'
    },
    comment: 'Entrega a la que pertenece'
  },
  sale_detail_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sale_details',
      key: 'id'
    },
    comment: 'Detalle de venta asociado'
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    },
    comment: 'Producto entregado'
  },
  presentation_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'product_presentations',
      key: 'id'
    },
    comment: 'Presentación del producto'
  },
  package_quantity_delivered: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Cantidad de paquetes entregados'
  },
  loose_units_delivered: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Cantidad de unidades sueltas entregadas'
  }
}, {
  tableName: 'delivery_details',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_delivery_details_delivery',
      fields: ['delivery_id']
    },
    {
      name: 'idx_delivery_details_sale_detail',
      fields: ['sale_detail_id']
    },
    {
      name: 'idx_delivery_details_product',
      fields: ['product_id']
    },
    {
      name: 'idx_delivery_details_presentation',
      fields: ['presentation_id']
    }
  ]
});

module.exports = DeliveryDetail;
