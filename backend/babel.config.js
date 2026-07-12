// Solo para jest: permite que babel-jest transpile los módulos TypeScript
// (tsx corre la app en dev/prod; tsc --noEmit valida tipos en CI).
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-typescript', { allowDeclareFields: true }],
  ],
};
