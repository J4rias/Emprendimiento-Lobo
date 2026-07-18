import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface CustomerLedgerAttributes {
  id: number;
  customer_id: number;
  transaction_date: Date;
  transaction_type: 'sale' | 'payment' | 'credit_note' | 'cancellation' | 'adjustment';
  reference_id: number | null;
  reference_type: 'sale' | 'sale_payment' | 'credit_note' | null;
  description: string;
  debit: number;
  credit: number;
  balance_after: number;
  created_by: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CustomerLedgerCreationAttributes extends Optional<
  CustomerLedgerAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'reference_id' | 'reference_type' | 'debit' | 'credit'
> {}

const CustomerLedger = sequelize.define<Model<CustomerLedgerAttributes, CustomerLedgerCreationAttributes>>(
  'CustomerLedger',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'customers', key: 'id' }
    },
    transaction_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    transaction_type: {
      type: DataTypes.ENUM('sale', 'payment', 'credit_note', 'cancellation', 'adjustment'),
      allowNull: false
    },
    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    reference_type: {
      type: DataTypes.ENUM('sale', 'sale_payment', 'credit_note'),
      allowNull: true
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    debit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Incrementa deuda del cliente (USD)'
    },
    credit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Reduce deuda del cliente (USD)'
    },
    balance_after: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Snapshot del saldo neto después de esta entrada'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    }
  },
  {
    tableName: 'customer_ledger',
    timestamps: true,
    underscored: true
  }
);

export = CustomerLedger;
