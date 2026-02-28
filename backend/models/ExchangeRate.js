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

// Método para obtener la tasa de cambio efectiva para una fecha específica usando BFS (Grafos)
ExchangeRate.getRate = async function (fromCurrency, toCurrency, date = new Date()) {
  // Si son la misma moneda, la tasa es 1
  if (fromCurrency === toCurrency) {
    return 1;
  }

  const effectiveDate = date instanceof Date ? date.toISOString().split('T')[0] : date;

  // Obtener todas las tasas activas históricas ordenadas por fecha reciente (para priorizar las más actuales)
  // Lo ideal es traer solo las que aplican para effectiveDate o anteriores
  const { Op } = require('sequelize');
  const allRates = await ExchangeRate.findAll({
    where: {
      is_active: true,
      effective_date: {
        [Op.lte]: effectiveDate
      }
    },
    order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
  });

  if (!allRates || allRates.length === 0) {
    throw new Error(`No hay tasas de cambio activas registradas en el sistema para calcular ${fromCurrency} a ${toCurrency}.`);
  }

  // 1. Construir el Grafo utilizando un mapa de Adyacencia
  // graph = { 'USD': { 'VES': rate1, 'COP': rate2 }, 'VES': { 'USD': 1/rate1 } }
  const graph = {};

  // Agregar solo LATEST rate for each combination para no sobreescribir con datos viejos accidentalmente
  // Dado que iteramos sobre `allRates` que está ordenado por DESC, la PRIMERA vez que veamos una combinación será la más reciente.
  const seenCombos = new Set();

  for (const rateObj of allRates) {
    const from = rateObj.from_currency;
    const to = rateObj.to_currency;
    const rateVal = parseFloat(rateObj.rate);

    const directKey = `${from}-${to}`;
    const inverseKey = `${to}-${from}`;

    if (!seenCombos.has(directKey)) {
      // Inicializar nodos si no existen
      if (!graph[from]) graph[from] = {};
      if (!graph[to]) graph[to] = {};

      // Agregar arista directa
      graph[from][to] = rateVal;
      seenCombos.add(directKey);
    }

    if (!seenCombos.has(inverseKey)) {
      // Inicializar nodos si no existen (ya hecho arriba igual)
      if (!graph[from]) graph[from] = {};
      if (!graph[to]) graph[to] = {};

      // Agregar arista inversa (1 / rate)
      graph[to][from] = 1 / rateVal;
      seenCombos.add(inverseKey);
    }
  }

  // 2. Ejecutar Breadth-First Search (BFS) para encontrar el camino (y la tasa multiplicada)
  // Queue guardará el nodo actual (moneda) y la tasa acumulada hasta el momento
  const queue = [{ node: fromCurrency, cumulativeRate: 1 }];
  const visited = new Set();
  visited.add(fromCurrency);

  while (queue.length > 0) {
    const { node, cumulativeRate } = queue.shift();

    // Si llegamos a nuestro destino, retornamos la tasa calculada!
    if (node === toCurrency) {
      return cumulativeRate;
    }

    // Explorar vecinos
    const neighbors = graph[node];
    if (neighbors) {
      for (const [neighborCurrency, edgeRate] of Object.entries(neighbors)) {
        if (!visited.has(neighborCurrency)) {
          visited.add(neighborCurrency);

          // La nueva tasa es la tasa que traíamos acumulada MULTIPLICADA por la arista hacia el vecino
          const newCumulativeRate = cumulativeRate * edgeRate;

          queue.push({ node: neighborCurrency, cumulativeRate: newCumulativeRate });
        }
      }
    }
  }

  // 3. Si el BFS termina y no llegamos, no existe camino o combinación lógica.
  throw new Error(`No se encontró ruta de conversión de ${fromCurrency} a ${toCurrency}`);
};

// Método para convertir un monto de una moneda a otra
ExchangeRate.convert = async function (amount, fromCurrency, toCurrency, date = new Date()) {
  const rate = await ExchangeRate.getRate(fromCurrency, toCurrency, date);
  return amount * rate;
};

module.exports = ExchangeRate;
