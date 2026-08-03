import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface SaleAttributes {
  id: number;
  sale_number: string;
  customer_id: number | null;
  warehouse_id: number;
  user_id: number;
  sale_date: Date;
  sale_type: 'cash' | 'credit' | 'mixed';
  payment_method: 'cash' | 'card' | 'transfer' | 'mixed' | 'usdt' | null;
  currency_mode: 'USD' | 'COP';
  exchange_rate: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  credit_amount: number;
  paid_amount: number;
  change_amount: number;
  total_commission: number;
  status: 'pending' | 'completed' | 'cancelled' | 'returned' | 'delivered';
  notes: string | null;
  quote_id: number | null;
  created_by: number;
  authorized_by: number | null;
  updated_by: number | null;
  deleted_at: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface SaleCreationAttributes extends Optional<
  SaleAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'deleted_at' | 'sale_date' | 'sale_type' | 'exchange_rate' | 'subtotal' | 'tax_amount' | 'discount_amount' | 'total' | 'credit_amount' | 'paid_amount' | 'change_amount' | 'total_commission' | 'status'
> {}

// 3. sequelize.define con los genéricos
const Sale = sequelize.define<Model<SaleAttributes, SaleCreationAttributes>>(
  'Sale',
  {
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
      type: DataTypes.ENUM('cash', 'credit', 'mixed', 'pos_pending'),
      allowNull: false,
      defaultValue: 'cash',
      comment: 'Tipo de venta: contado, crédito, mixta o pendiente de cobro (vendedor)'
    },
    payment_method: {
      type: DataTypes.ENUM('cash', 'card', 'transfer', 'mixed', 'usdt'),
      allowNull: true,
      comment: 'Método de pago (solo para ventas de contado)'
    },
    currency_mode: {
      type: DataTypes.ENUM('USD', 'COP'),
      allowNull: false,
      defaultValue: 'COP',
      comment: 'Modo de moneda activo en el POS al momento de la venta'
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
    credit_amount: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Monto a crédito (para ventas mixtas)'
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
    total_commission: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Comisión total de la venta (COP)'
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
    authorized_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Admin que autorizó la venta a crédito'
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
  },
  {
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
  }
);

export = Sale;