const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Sale = sequelize.define('Sale', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sale_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Número de venta único autogenerado'
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id'
    },
    comment: 'Cliente (opcional para ventas de mostrador)'
  },
  warehouse_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'warehouses',
      key: 'id'
    },
    comment: 'Depósito desde donde se realiza la venta'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Usuario que registra la venta (vendedor/cajero)'
  },
  sale_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Fecha y hora de la venta'
  },
  sale_type: {
    type: DataTypes.ENUM('cash', 'credit'),
    allowNull: false,
    defaultValue: 'cash',
    comment: 'Tipo de venta: contado o crédito'
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'card', 'transfer', 'mixed'),
    allowNull: true,
    comment: 'Método de pago (solo para ventas de contado)'
  },
  exchange_rate: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 1.0000,
    comment: 'Tasa de cambio (USD a COP) al momento de la venta'
  },
  subtotal: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Subtotal antes de impuestos'
  },
  tax_amount: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Monto de impuestos (IVA)'
  },
  discount_amount: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Monto de descuento aplicado'
  },
  total: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Total de la venta'
  },
  paid_amount: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Monto pagado'
  },
  change_amount: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Vuelto entregado'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'returned', 'delivered'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Estado de la venta'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas u observaciones'
  },
  quote_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'quotes',
      key: 'id'
    },
    comment: 'Cotización origen (si aplica)'
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
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'sales',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['sale_number'], unique: true },
    { fields: ['customer_id'] },
    { fields: ['warehouse_id'] },
    { fields: ['user_id'] },
    { fields: ['sale_date'] },
    { fields: ['status'] },
    { fields: ['sale_type'] },
    { fields: ['quote_id'] }
  ]
});

module.exports = Sale;
