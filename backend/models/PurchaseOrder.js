const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_number: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    comment: 'Número único de orden de compra (OC-YYYYMMDD-####)'
  },
  supplier_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'suppliers',
      key: 'id'
    }
  },
  warehouse_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'warehouses',
      key: 'id'
    },
    comment: 'Almacén de destino para la recepción'
  },
  order_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  expected_delivery_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Fecha esperada de entrega'
  },
  delivery_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Fecha real de entrega (cuando se completa la recepción)'
  },
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'),
    allowNull: false,
    defaultValue: 'draft',
    comment: 'Estado: borrador, enviada, confirmada, recibida parcialmente, recibida, cancelada'
  },
  currency: {
    type: DataTypes.ENUM('USD', 'COP', 'VES'),
    allowNull: false,
    defaultValue: 'USD',
    comment: 'Moneda de la orden de compra'
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Subtotal antes de impuestos y descuentos'
  },
  tax_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Monto total de impuestos'
  },
  discount_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Monto total de descuentos'
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Total de la orden'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas o comentarios adicionales'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Usuario que aprobó/envió la orden'
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha y hora de aprobación'
  }
}, {
  tableName: 'purchase_orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['order_number']
    },
    {
      fields: ['supplier_id']
    },
    {
      fields: ['warehouse_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['order_date']
    }
  ]
});

module.exports = PurchaseOrder;
