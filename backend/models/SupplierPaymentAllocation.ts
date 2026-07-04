import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface SupplierPaymentAllocationAttributes {
  id: number;
  payment_id: number;
  purchase_order_id: number;
  invoice_number: string | null;
  allocated_amount: number;
  allocated_amount_po_currency: number;
  exchange_rate_used: number | null;
  created_at?: Date;
  updated_at?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface SupplierPaymentAllocationCreationAttributes extends Optional<
  SupplierPaymentAllocationAttributes,
  'id' | 'created_at' | 'updated_at' | 'allocated_amount' | 'allocated_amount_po_currency'
> {}

// 3. sequelize.define con los genéricos
const SupplierPaymentAllocation = sequelize.define<Model<SupplierPaymentAllocationAttributes, SupplierPaymentAllocationCreationAttributes>>(
  'SupplierPaymentAllocation',
  {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    payment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'supplier_payments',
            key: 'id'
        }
    },
    purchase_order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'purchase_orders',
            key: 'id'
        }
    },
    invoice_number: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Factura del proveedor asociada a esta adjudicación'
    },
    allocated_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Monto asignado en la moneda del pago'
    },
    allocated_amount_po_currency: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Monto equivalente en la moneda de la OC (congelado al momento del pago)'
    },
    exchange_rate_used: {
        type: DataTypes.DECIMAL(12, 6),
        allowNull: true,
        comment: 'Tasa de conversión usada, congelada al momento del pago'
    }
  },
  {
    tableName: 'supplier_payment_allocations',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: 'idx_spa_payment',
            fields: ['payment_id']
        },
        {
            name: 'idx_spa_purchase_order',
            fields: ['purchase_order_id']
        }
    ]
  }
);

export = SupplierPaymentAllocation;