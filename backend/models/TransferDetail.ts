import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface TransferDetailAttributes {
  id: number;
  transfer_id: number;
  product_id: number;
  batch_id: number | null;
  presentation_id: number | null;
  package_quantity: number;
  loose_units: number;
  quantity_requested: number;
  quantity_shipped: number;
  quantity_received: number;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface TransferDetailCreationAttributes extends Optional<
  TransferDetailAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'package_quantity' | 'loose_units' | 'quantity_shipped' | 'quantity_received'
> {}

// 3. sequelize.define con los genéricos
const TransferDetail = sequelize.define<Model<TransferDetailAttributes, TransferDetailCreationAttributes>>(
  'TransferDetail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    transfer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'transfers',
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
    batch_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'batches',
        key: 'id'
      }
    },
    presentation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'product_presentations',
        key: 'id'
      },
      comment: 'Presentación usada en la transferencia'
    },
    package_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Cantidad de paquetes transferidos'
    },
    loose_units: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Unidades sueltas transferidas'
    },
    quantity_requested: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    quantity_shipped: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    quantity_received: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    tableName: 'transfer_details',
    timestamps: true
  }
);

// 5. export = en lugar de module.exports = (CJS compat con TypeScript)
export = TransferDetail;