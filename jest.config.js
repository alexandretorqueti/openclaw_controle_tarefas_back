// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Vamos ser ultra-específicos para não dar margem ao erro de picomatch
  testMatch: [
    "<rootDir>/test/**/*.test.ts"
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  // Se o erro persistir, desative o cache do transformador
  cache: false
};