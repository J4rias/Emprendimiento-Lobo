import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PreOrderDetailAttributes {
  id: number;
  pre_order_id: number;
  product_id: number;
  presentation_id: number;
  quantity: number; // DECIMAL(10, 2) → number
  is_unit: boolean;
  unit_price: number; // DECIMAL(18, 2) → number
  total: number; // DECIMAL(18, 2) → number
  notes: string | null; // allowNull: true → T | null
  createdAt?: Date;
  updatedAt?: Date;
}

interface PreOrderDetailCreationAttributes extends Optional<
  PreOrderDetailAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'is_unit'
> {}

const PreOrderDetail = sequelize.define<Model<PreOrderDetailAttributes, PreOrderDetailCreationAttributes>>(
  'PreOrderDetail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    pre_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    presentation_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    is_unit: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    unit_price: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false
    },
    total: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  },
  {
    tableName: 'pre_order_details',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeSave: (detail: any) => {
        detail.total = detail.quantity * detail.unit_price;
      }
    }
  }
);

export = PreOrderDetail;
