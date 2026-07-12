import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface PurchaseOrderDetailAttributes {
  id: number;
  purchase_order_id: number;
  product_id: number;
  presentation_id: number;
  package_quantity: number;
  loose_units: number;
  unit_cost: number;
  package_cost: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
  received_package_quantity: number;
  received_loose_units: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface PurchaseOrderDetailCreationAttributes extends Optional<
  PurchaseOrderDetailAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'package_quantity' | 'loose_units' | 'unit_cost' | 'package_cost' | 'discount_percent' | 'tax_percent' | 'line_total' | 'received_package_quantity' | 'received_loose_units'
> {}

// 3. sequelize.define con los genéricos
const PurchaseOrderDetail = sequelize.define<Model<PurchaseOrderDetailAttributes, PurchaseOrderDetailCreationAttributes>>(
  'PurchaseOrderDetail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    purchase_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'purchase_orders',
        key: 'id'
      }
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    presentation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'product_presentations',
        key: 'id'
      }
    },
    package_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cantidad de paquetes ordenados'
    },
    loose_units: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cantidad de unidades sueltas ordenadas'
    },
    unit_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Costo por unidad individual'
    },
    package_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Costo por paquete completo'
    },
    discount_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Porcentaje de descuento aplicado'
    },
    tax_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Porcentaje de impuesto aplicado'
    },
    line_total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Total de la línea (con descuentos e impuestos)'
    },
    received_package_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cantidad de paquetes recibidos hasta ahora'
    },
    received_loose_units: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cantidad de unidades sueltas recibidas hasta ahora'
    }
  },
  {
    tableName: 'purchase_order_details',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['purchase_order_id']
      },
      {
        fields: ['product_id']
      },
      {
        fields: ['presentation_id']
      }
    ]
  }
);

// 5. export = en lugar de module.exports = (CJS compat con TypeScript)
export = PurchaseOrderDetail;