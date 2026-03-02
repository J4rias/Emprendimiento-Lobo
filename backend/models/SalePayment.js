const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SalePayment = sequelize.define('SalePayment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sales',
      key: 'id'
    },
    comment: 'Venta a la que pertenece el pago'
  },
  payment_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Fecha del pago'
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'card', 'transfer', 'check', 'other'),
    allowNull: false,
    comment: 'Método de pago'
  },
  currency: {
    type: DataTypes.ENUM('USD', 'COP', 'VES'),
    allowNull: false,
    defaultValue: 'USD',
    comment: 'Moneda en la que se recibió el pago'
  },
  exchange_rate: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 1.0000,
    comment: 'Tasa de cambio aplicada respecto a la moneda base (USD)'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'Monto del pago'
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Referencia del pago (número de transacción, cheque, etc.)'
  },
  bank_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Banco (si aplica)'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas del pago'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'sale_payments',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['sale_id'] },
    { fields: ['payment_date'] },
    { fields: ['payment_method'] }
  ]
});

module.exports = SalePayment;
