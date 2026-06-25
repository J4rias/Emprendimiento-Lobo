const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Bank = sequelize.define('Bank', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nombre del banco o entidad financiera'
  },
  currency: {
    type: DataTypes.ENUM('USD', 'COP', 'VES'),
    allowNull: false,
    comment: 'Moneda principal del banco'
  },
  type: {
    type: DataTypes.ENUM('bank', 'wallet', 'other'),
    allowNull: false,
    defaultValue: 'bank',
    comment: 'Tipo: bank=banco tradicional, wallet=billetera digital, other=otro'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'banks',
  timestamps: true,
  underscored: true
});

module.exports = Bank;
