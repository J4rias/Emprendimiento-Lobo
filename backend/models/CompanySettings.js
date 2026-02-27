const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CompanySettings = sequelize.define('CompanySettings', {
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
}, {
  tableName: 'company_settings',
  underscored: true,
  timestamps: true,
});

module.exports = CompanySettings;
