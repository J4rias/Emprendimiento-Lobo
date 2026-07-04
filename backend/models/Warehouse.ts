import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface WarehouseAttributes {
  id: number;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  phone: string | null;
  manager_id: number | null;
  is_main: boolean;
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface WarehouseCreationAttributes extends Optional<
  WarehouseAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'country' | 'is_main' | 'is_active'
> {}

// 3. sequelize.define con los genéricos
const Warehouse = sequelize.define<Model<WarehouseAttributes, WarehouseCreationAttributes>>(
  'Warehouse',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(100),
      defaultValue: 'Venezuela'
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    manager_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    is_main: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    tableName: 'warehouses',
    timestamps: true
  }
);

export = Warehouse;