import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PresentationTypeAttributes {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PresentationTypeCreationAttributes extends Optional<
  PresentationTypeAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'is_active'
> {}

const PresentationType = sequelize.define<Model<PresentationTypeAttributes, PresentationTypeCreationAttributes>>(
  'PresentationType',
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
      comment: 'Tipo de presentación: botella, bolsa, lata, caja, etc.'
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
    tableName: 'presentation_types',
    timestamps: true,
    underscored: true
  }
);

export = PresentationType;