const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExchangeRate = sequelize.define('ExchangeRate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  from_currency: {
    type: DataTypes.ENUM('USD', 'COP', 'VES'),
    allowNull: false,
    comment: 'Moneda origen'
  },
  to_currency: {
    type: DataTypes.ENUM('USD', 'COP', 'VES'),
    allowNull: false,
    comment: 'Moneda destino'
  },
  rate: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    comment: 'Tasa de cambio (1 from_currency = rate to_currency)'
  },
  effective_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Fecha efectiva de la tasa'
  },
  source: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Fuente de la tasa (ej: BCV, Banco Central, Manual)'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas adicionales'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Indica si la tasa está activa'
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
  tableName: 'exchange_rates',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['from_currency', 'to_currency', 'effective_date'],
      name: 'unique_exchange_rate_per_day'
    },
    {
      fields: ['effective_date']
    },
    {
      fields: ['is_active']
    }
  ]
});

// Método para obtener la tasa de cambio efectiva para una fecha específica
ExchangeRate.getRate = async function(fromCurrency, toCurrency, date = new Date()) {
  // Si son la misma moneda, la tasa es 1
  if (fromCurrency === toCurrency) {
    return 1;
  }

  const effectiveDate = date instanceof Date ? date.toISOString().split('T')[0] : date;

  const rate = await ExchangeRate.findOne({
    where: {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      effective_date: effectiveDate,
      is_active: true
    },
    order: [['created_at', 'DESC']]
  });

  if (rate) {
    return parseFloat(rate.rate);
  }

  // Si no hay tasa directa, intentar conversión inversa
  const inverseRate = await ExchangeRate.findOne({
    where: {
      from_currency: toCurrency,
      to_currency: fromCurrency,
      effective_date: effectiveDate,
      is_active: true
    },
    order: [['created_at', 'DESC']]
  });

  if (inverseRate) {
    return 1 / parseFloat(inverseRate.rate);
  }

  // Si no hay tasa para el día específico, buscar la más reciente
  const latestRate = await ExchangeRate.findOne({
    where: {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      is_active: true
    },
    order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
  });

  if (latestRate) {
    return parseFloat(latestRate.rate);
  }

  throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
};

// Método para convertir un monto de una moneda a otra
ExchangeRate.convert = async function(amount, fromCurrency, toCurrency, date = new Date()) {
  const rate = await ExchangeRate.getRate(fromCurrency, toCurrency, date);
  return amount * rate;
};

module.exports = ExchangeRate;
