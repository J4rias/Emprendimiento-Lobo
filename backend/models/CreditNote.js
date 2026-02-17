const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CreditNote = sequelize.define('CreditNote', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  credit_note_number: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    comment: 'Formato: NC-YYYYMMDD-####'
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sales',
      key: 'id'
    },
    comment: 'Venta original a la que se aplica la nota de crédito'
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    },
    comment: 'Cliente al que se emite la nota de crédito'
  },
  warehouse_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'warehouses',
      key: 'id'
    },
    comment: 'Almacén donde se devuelve la mercancía'
  },
  credit_note_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Fecha de emisión de la nota de crédito'
  },
  reason: {
    type: DataTypes.ENUM('return', 'discount', 'error', 'other'),
    allowNull: false,
    comment: 'Motivo de la nota de crédito'
  },
  reason_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descripción detallada del motivo'
  },
  type: {
    type: DataTypes.ENUM('full', 'partial'),
    allowNull: false,
    defaultValue: 'partial',
    comment: 'Tipo de devolución: total o parcial'
  },
  status: {
    type: DataTypes.ENUM('draft', 'approved', 'applied', 'cancelled'),
    allowNull: false,
    defaultValue: 'draft',
    comment: 'Estado de la nota de crédito'
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Subtotal de la nota de crédito'
  },
  tax_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Monto de impuestos'
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Total de la nota de crédito'
  },
  refund_method: {
    type: DataTypes.ENUM('cash', 'transfer', 'credit_balance', 'none'),
    allowNull: false,
    defaultValue: 'none',
    comment: 'Método de reembolso al cliente'
  },
  refund_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Monto reembolsado'
  },
  refund_reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Referencia del reembolso (número de cheque, transferencia, etc.)'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas adicionales'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Usuario que creó la nota de crédito'
  },
  approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Usuario que aprobó la nota de crédito'
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha y hora de aprobación'
  }
}, {
  tableName: 'credit_notes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_credit_notes_sale',
      fields: ['sale_id']
    },
    {
      name: 'idx_credit_notes_customer',
      fields: ['customer_id']
    },
    {
      name: 'idx_credit_notes_warehouse',
      fields: ['warehouse_id']
    },
    {
      name: 'idx_credit_notes_status',
      fields: ['status']
    },
    {
      name: 'idx_credit_notes_date',
      fields: ['credit_note_date']
    },
    {
      name: 'idx_credit_notes_number',
      fields: ['credit_note_number']
    }
  ]
});

module.exports = CreditNote;
