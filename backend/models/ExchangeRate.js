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

  // 1. Buscar tasa directa para la fecha específica
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

  // 2. Buscar tasa inversa para la fecha específica
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

  // 3. Buscar tasa directa más reciente
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

  // 4. Buscar tasa inversa más reciente
  const latestInverseRate = await ExchangeRate.findOne({
    where: {
      from_currency: toCurrency,
      to_currency: fromCurrency,
      is_active: true
    },
    order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
  });

  if (latestInverseRate) {
    return 1 / parseFloat(latestInverseRate.rate);
  }

  // 5. NUEVO: Conversión triangular usando USD como moneda puente
  // Si no encontramos tasa directa ni inversa, intentar conversión triangular
  // Ejemplo: VES → COP = (VES → USD) × (USD → COP)
  const bridgeCurrency = 'USD';

  if (fromCurrency !== bridgeCurrency && toCurrency !== bridgeCurrency) {
    try {
      // Buscar tasas más recientes para conversión triangular
      const fromToBridge = await ExchangeRate.findOne({
        where: {
          from_currency: fromCurrency,
          to_currency: bridgeCurrency,
          is_active: true
        },
        order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
      });

      const bridgeToTo = await ExchangeRate.findOne({
        where: {
          from_currency: bridgeCurrency,
          to_currency: toCurrency,
          is_active: true
        },
        order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
      });

      // Si encontramos ambas tasas, hacer conversión triangular
      if (fromToBridge && bridgeToTo) {
        const triangularRate = parseFloat(fromToBridge.rate) * parseFloat(bridgeToTo.rate);
        return triangularRate;
      }

      // Intentar con tasas inversas para la triangulación
      const bridgeToFrom = await ExchangeRate.findOne({
        where: {
          from_currency: bridgeCurrency,
          to_currency: fromCurrency,
          is_active: true
        },
        order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
      });

      if (bridgeToFrom && bridgeToTo) {
        const triangularRate = (1 / parseFloat(bridgeToFrom.rate)) * parseFloat(bridgeToTo.rate);
        return triangularRate;
      }

      const fromToBridge2 = await ExchangeRate.findOne({
        where: {
          from_currency: fromCurrency,
          to_currency: bridgeCurrency,
          is_active: true
        },
        order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
      });

      const toToBridge = await ExchangeRate.findOne({
        where: {
          from_currency: toCurrency,
          to_currency: bridgeCurrency,
          is_active: true
        },
        order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
      });

      if (fromToBridge2 && toToBridge) {
        const triangularRate = parseFloat(fromToBridge2.rate) / parseFloat(toToBridge.rate);
        return triangularRate;
      }

    } catch (triangularError) {
      // Si falla la conversión triangular, continuar con el error original
      console.error('Triangular conversion failed:', triangularError.message);
    }
  }

  throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
};

// Método para convertir un monto de una moneda a otra
ExchangeRate.convert = async function(amount, fromCurrency, toCurrency, date = new Date()) {
  const rate = await ExchangeRate.getRate(fromCurrency, toCurrency, date);
  return amount * rate;
};

module.exports = ExchangeRate;
