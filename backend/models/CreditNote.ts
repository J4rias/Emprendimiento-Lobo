import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface CreditNoteAttributes {
  id: number;
  credit_note_number: string;
  sale_id: number;
  customer_id: number | null;
  warehouse_id: number;
  credit_note_date: Date;
  reason: 'return' | 'discount' | 'error' | 'other';
  reason_description: string | null;
  type: 'full' | 'partial';
  status: 'draft' | 'approved' | 'applied' | 'cancelled';
  exchange_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  refund_method: 'cash' | 'transfer' | 'credit_balance' | 'none';
  refund_amount: number;
  refund_reference: string | null;
  notes: string | null;
  created_by: number;
  approved_by: number | null;
  approved_at: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CreditNoteCreationAttributes extends Optional<
  CreditNoteAttributes,
  'id' | 'createdAt' | 'updatedAt' |
  'customer_id' | 'reason_description' | 'refund_reference' | 'notes' |
  'approved_by' | 'approved_at'
> {}

const CreditNote = sequelize.define<Model<CreditNoteAttributes, CreditNoteCreationAttributes>>('CreditNote', {
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
    allowNull: true,
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
  exchange_rate: {
    type: DataTypes.DECIMAL(15, 6),
    allowNull: false,
    defaultValue: 1.000000,
    comment: 'Tasa de cambio USD→COP al momento de la devolución (copiada de la venta)'
  },
  subtotal: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Subtotal de la nota de crédito en USD'
  },
  tax_amount: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Monto de impuestos'
  },
  total: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Total de la nota de crédito en USD (alta precisión para conversión exacta a COP)'
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

export = CreditNote;