import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface SalePaymentAttributes {
  id: number;
  sale_id: number;
  payment_date: Date;
  payment_method: 'cash' | 'card' | 'transfer' | 'check' | 'other' | 'credit_balance' | 'usdt';
  currency: 'USD' | 'COP' | 'VES';
  exchange_rate: number;
  amount: number;
  reference: string | null;
  bank_id: number | null;
  receipt_url: string | null;
  notes: string | null;
  reversed_at: Date | null;
  reversed_by: number | null;
  created_by: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface SalePaymentCreationAttributes extends Optional<
  SalePaymentAttributes,
  'id' | 'payment_date' | 'currency' | 'exchange_rate' | 'reversed_at' | 'reversed_by' | 'receipt_url' | 'createdAt' | 'updatedAt'
> {}

// 3. sequelize.define con los genéricos
const SalePayment = sequelize.define<Model<SalePaymentAttributes, SalePaymentCreationAttributes>>(
  'SalePayment',
  {
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
      type: DataTypes.ENUM('cash', 'card', 'transfer', 'check', 'other', 'credit_balance', 'usdt'),
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
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 1.0000,
      comment: 'Tasa de cambio aplicada respecto a la moneda base (USD)'
    },
    amount: {
      type: DataTypes.DECIMAL(18, 6),
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
    receipt_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'URL de la foto del comprobante (transferencia/USDT), si se adjuntó'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas del pago'
    },
    reversed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de reversión del pago (null = vigente)'
    },
    reversed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Usuario que revirtió el pago'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  },
  {
    tableName: 'sale_payments',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['sale_id'] },
      { fields: ['payment_date'] },
      { fields: ['payment_method'] }
    ]
  }
);

// 5. export = en lugar de module.exports = (CJS compat con TypeScript)
export = SalePayment;