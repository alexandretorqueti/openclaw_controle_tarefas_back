import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/universalEngine'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'monitor/**/*.ts',
    '!monitor/**/*.d.ts',
    '!monitor/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['dotenv/config'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default config;
