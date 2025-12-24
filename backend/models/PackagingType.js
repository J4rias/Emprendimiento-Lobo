const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PackagingType = sequelize.define('PackagingType', {
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
}, {
  tableName: 'packaging_types',
  timestamps: true,
  underscored: true
});

module.exports = PackagingType;
