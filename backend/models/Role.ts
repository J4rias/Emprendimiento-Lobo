import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface RoleAttributes {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface RoleCreationAttributes extends Optional<
  RoleAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'is_active'
> {}

// 3. sequelize.define con los genéricos
const Role = sequelize.define<Model<RoleAttributes, RoleCreationAttributes>>(
  'Role',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    tableName: 'roles',
    timestamps: true
  }
);

export = Role;