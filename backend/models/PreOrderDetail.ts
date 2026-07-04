import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PreOrderDetailAttributes {
  id: number;
  preOrderId: number;
  productId: number;
  presentationId: number;
  quantity: number; // DECIMAL(10, 2) → number
  isUnit: boolean;
  unitPrice: number; // DECIMAL(18, 2) → number
  total: number; // DECIMAL(18, 2) → number
  notes: string | null; // allowNull: true → T | null
  createdAt?: Date;
  updatedAt?: Date;
}

interface PreOrderDetailCreationAttributes extends Optional<
  PreOrderDetailAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'isUnit'
> {}

const PreOrderDetail = sequelize.define<Model<PreOrderDetailAttributes, PreOrderDetailCreationAttributes>>(
  'PreOrderDetail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    preOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    presentationId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    isUnit: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    unitPrice: {
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
        detail.total = detail.quantity * detail.unitPrice;
      }
    }
  }
);

export = PreOrderDetail;