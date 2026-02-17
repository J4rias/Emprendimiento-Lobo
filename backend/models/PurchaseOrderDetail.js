const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseOrderDetail = sequelize.define('PurchaseOrderDetail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  purchase_order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purchase_orders',
      key: 'id'
    }
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
  package_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Cantidad de paquetes ordenados'
  },
  loose_units: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Cantidad de unidades sueltas ordenadas'
  },
  unit_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Costo por unidad individual'
  },
  package_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Costo por paquete completo'
  },
  discount_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Porcentaje de descuento aplicado'
  },
  tax_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Porcentaje de impuesto aplicado'
  },
  line_total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Total de la línea (con descuentos e impuestos)'
  },
  received_package_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Cantidad de paquetes recibidos hasta ahora'
  },
  received_loose_units: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Cantidad de unidades sueltas recibidas hasta ahora'
  }
}, {
  tableName: 'purchase_order_details',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['purchase_order_id']
    },
    {
      fields: ['product_id']
    },
    {
      fields: ['presentation_id']
    }
  ]
});

module.exports = PurchaseOrderDetail;
