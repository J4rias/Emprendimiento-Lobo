import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface CompanySettingsAttributes {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  website: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CompanySettingsCreationAttributes extends Optional<
  CompanySettingsAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'name'
> {}

const CompanySettings = sequelize.define<Model<CompanySettingsAttributes, CompanySettingsCreationAttributes>>(
  'CompanySettings',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: 'Mi Empresa',
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    tax_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
  },
  {
    tableName: 'company_settings',
    underscored: true,
    timestamps: true,
  }
);

export = CompanySettings;