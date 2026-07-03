/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
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
