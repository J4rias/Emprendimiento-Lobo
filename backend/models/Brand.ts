import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface BrandAttributes {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: number;
  updated_by: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BrandCreationAttributes extends Optional<
  BrandAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'description' | 'logo_url' | 'website' | 'notes' | 'is_active' | 'updated_by'
> {}

const Brand = sequelize.define<Model<BrandAttributes, BrandCreationAttributes>>('Brand', {
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
    type: DataTypes.TEXT,
    allowNull: true
  },
  logo_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  website: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'brands',
  timestamps: true,
  paranoid: true
});

export = Brand;