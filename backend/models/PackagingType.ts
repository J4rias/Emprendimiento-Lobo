import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PackagingTypeAttributes {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PackagingTypeCreationAttributes extends Optional<
  PackagingTypeAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'is_active'
> {}

const PackagingType = sequelize.define<Model<PackagingTypeAttributes, PackagingTypeCreationAttributes>>(
  'PackagingType',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Tipo de empaque: bandeja, caja, fardo, etc.'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    tableName: 'packaging_types',
    timestamps: true,
    underscored: true,
    paranoid: true
  }
);

export = PackagingType;