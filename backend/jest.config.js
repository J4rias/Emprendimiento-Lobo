/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // .ts primero: imita la resolución de tsx (config/database.js es solo para sequelize-cli)
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
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
