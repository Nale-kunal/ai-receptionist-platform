import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.test.json',
      diagnostics: {
        ignoreCodes: ['TS2304', 'TS7016'],
      },
    },
  },
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  testTimeout: 30000,
  verbose: true,
  collectCoverage: false,
};

export default config;
