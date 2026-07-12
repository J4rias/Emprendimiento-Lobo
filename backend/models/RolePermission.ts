import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface RolePermissionAttributes {
  id: number;
  role_id: number;
  permission_id: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface RolePermissionCreationAttributes extends Optional<
  RolePermissionAttributes,
  'id' | 'createdAt' | 'updatedAt'
> {}

// 3. sequelize.define con los genéricos
const RolePermission = sequelize.define<Model<RolePermissionAttributes, RolePermissionCreationAttributes>>(
  'RolePermission',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      }
    },
    permission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'permissions',
        key: 'id'
      }
    }
  },
  {
    tableName: 'role_permissions',
    timestamps: true
  }
);

// 5. export = en lugar de module.exports = (CJS compat con TypeScript)
export = RolePermission;