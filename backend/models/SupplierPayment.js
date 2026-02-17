const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SupplierPayment = sequelize.define('SupplierPayment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  payment_number: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    comment: 'Formato: PP-YYYYMMDD-####'
  },
  supplier_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'suppliers',
      key: 'id'
    }
  },
  purchase_order_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'purchase_orders',
      key: 'id'
    },
    comment: 'Opcional - pago asociado a una orden específica'
  },
  payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Fecha del pago'
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'transfer', 'check', 'card', 'other'),
    allowNull: false,
    defaultValue: 'transfer',
    comment: 'Método de pago utilizado'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    },
    comment: 'Monto del pago'
  },
  currency: {
    type: DataTypes.ENUM('USD', 'COP', 'VES'),
    allowNull: false,
    defaultValue: 'USD',
    comment: 'Moneda del pago'
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Número de cheque, referencia de transferencia, etc.'
  },
  bank_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Banco utilizado para el pago (opcional) - sin FK por ahora'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas adicionales sobre el pago'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Usuario que registró el pago'
  }
}, {
  tableName: 'supplier_payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_supplier_payments_supplier',
      fields: ['supplier_id']
    },
    {
      name: 'idx_supplier_payments_purchase_order',
      fields: ['purchase_order_id']
    },
    {
      name: 'idx_supplier_payments_date',
      fields: ['payment_date']
    },
    {
      name: 'idx_supplier_payments_number',
      fields: ['payment_number']
    }
  ]
});

module.exports = SupplierPayment;
