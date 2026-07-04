import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface BatchAttributes {
  id: number;
  batch_number: string;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  manufacturing_date: Date | null;
  expiration_date: Date | null;
  cost: number;
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BatchCreationAttributes extends Optional<
  BatchAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'manufacturing_date' | 'expiration_date'
> {}

const Batch = sequelize.define<Model<BatchAttributes, BatchCreationAttributes>>(
  'Batch',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    batch_number: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'warehouses',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    manufacturing_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expiration_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    tableName: 'batches',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['batch_number', 'product_id', 'warehouse_id']
      }
    ]
  }
);

export = Batch;