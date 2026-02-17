const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductPresentation = sequelize.define('ProductPresentation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  packaging_type_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'packaging_types',
      key: 'id'
    },
    comment: 'Tipo de empaque (bandeja, caja, fardo)'
  },
  presentation_type_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'presentation_types',
      key: 'id'
    },
    comment: 'Tipo de presentación (botella, bolsa, lata)'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Ej: Bandeja de 6 botellas de 2L'
  },
  units_per_package: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Cantidad de unidades por empaque (ej: 6 botellas por bandeja)'
  },
  units_per_presentation: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Cantidad de unidades base en esta presentación (para compatibilidad)'
  },
  package_price: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    comment: 'Precio del empaque completo (ej: $8 por bandeja)'
  },
  package_cost: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    comment: 'Costo del empaque completo'
  },
  base_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  purchase_currency: {
    type: DataTypes.ENUM('USD', 'COP', 'VES'),
    allowNull: false,
    defaultValue: 'USD',
    comment: 'Moneda en la que se compró el producto'
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'product_presentations',
  timestamps: true
});

module.exports = ProductPresentation;
