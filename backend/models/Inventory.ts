import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface InventoryAttributes {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number; // VIRTUAL field
  last_count_date: Date | null;
  last_movement_date: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface InventoryCreationAttributes extends Optional<
  InventoryAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'last_count_date' | 'last_movement_date'
> {}

const Inventory = sequelize.define<Model<InventoryAttributes, InventoryCreationAttributes>>(
  'Inventory',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
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
    reserved_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Cantidad reservada en órdenes pendientes'
    },
    available_quantity: {
      type: DataTypes.VIRTUAL,
      get() {
        return (this as any).quantity - (this as any).reserved_quantity;
      }
    },
    last_count_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_movement_date: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'inventory',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['product_id', 'warehouse_id']
      }
    ]
  }
);

export = Inventory;