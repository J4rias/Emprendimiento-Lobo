import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PermissionAttributes {
  id: number;
  name: string;
  description: string | null;
  module: string;
  action: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PermissionCreationAttributes extends Optional<
  PermissionAttributes,
  'id' | 'createdAt' | 'updatedAt'
> {}

const Permission = sequelize.define<Model<PermissionAttributes, PermissionCreationAttributes>>(
  'Permission',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
    }
  },
  {
    tableName: 'permissions',
    timestamps: true
  }
);

export = Permission;