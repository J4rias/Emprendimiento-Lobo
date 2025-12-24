const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PresentationType = sequelize.define('PresentationType', {
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
}, {
  tableName: 'presentation_types',
  timestamps: true,
  underscored: true
});

module.exports = PresentationType;
