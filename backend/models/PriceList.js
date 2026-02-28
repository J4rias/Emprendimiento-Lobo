const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PriceList = sequelize.define('PriceList', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false,
    comment: 'Código único de la lista de precios'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nombre de la lista de precios'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  currency: {
    type: DataTypes.ENUM('USD', 'COP', 'VES'),
    allowNull: false,
    defaultValue: 'USD',
    comment: 'Moneda de la lista de precios'
  },
  basePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Porcentaje base de ajuste sobre el costo (+/-)'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indica si es la lista de precios por defecto'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  },
  validity_days: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    comment: 'Vigencia en días a partir de validFrom'
  },
  validFrom: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha de inicio de vigencia'
  },
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha de fin de vigencia'
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    comment: 'Usuario que actualizó la lista por última vez'
  }
}, {
  tableName: 'price_lists',
  timestamps: true,
  underscored: true,
  paranoid: false,
  indexes: [
    {
      fields: ['code']
    },
    {
      fields: ['status']
    }
  ],
  hooks: {
    beforeValidate: async (priceList) => {
      // Generar código automático si no existe
      if (!priceList.code) {
        const lastPriceList = await PriceList.findOne({
          order: [['id', 'DESC']],
          paranoid: false
        });

        const nextNumber = lastPriceList ? lastPriceList.id + 1 : 1;
        priceList.code = `LP-${String(nextNumber).padStart(4, '0')}`;
      }
    },
    beforeSave: async (priceList) => {
      // Si se marca como default, desmarcar las demás
      if (priceList.isDefault && priceList.changed('isDefault')) {
        await PriceList.update(
          { isDefault: false },
          {
            where: {
              isDefault: true,
              id: { [sequelize.Sequelize.Op.ne]: priceList.id }
            }
          }
        );
      }
      // Auto-calculate validUntil from validFrom + validity_days
      if (priceList.validFrom && priceList.validity_days) {
        const from = new Date(priceList.validFrom);
        from.setDate(from.getDate() + priceList.validity_days);
        priceList.validUntil = from;
      }
    }
  }
});

// Método para verificar si está vigente
PriceList.prototype.isValid = function () {
  const now = new Date();

  if (this.validFrom && now < this.validFrom) {
    return false;
  }

  if (this.validUntil && now > this.validUntil) {
    return false;
  }

  return this.status === 'active';
};

// Personalizar JSON
PriceList.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.isDeleted;
  return values;
};

module.exports = PriceList;
