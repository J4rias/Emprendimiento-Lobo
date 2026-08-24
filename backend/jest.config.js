/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // .ts primero: imita la resolución de tsx (config/database.js es solo para sequelize-cli)
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  // En serie, no en paralelo: todas las suites comparten la misma BD (una copia
  // de producción, a propósito). Con workers concurrentes la suite falla distinto
  // en cada corrida — chocan los generadores de número de documento y las pruebas
  // que verifican agregados (arqueo, vendedor) leen totales que otro worker mueve.
  // Medido el 2026-08-19: en serie 377/377 dos veces seguidas; en paralelo una
  // corrida tumbó arqueo-cuadre y vendedor-flow, y la siguiente cancel-with-nc.
  // La suite entera tarda ~30 s en serie, así que el paralelismo no compensa.
  maxWorkers: 1,
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
    '!**/*.bak',
  ],
  coverageThreshold: {
    global: { lines: 20 },
  },
  testTimeout: 30000,
  setupFiles: ['dotenv/config'],
};
