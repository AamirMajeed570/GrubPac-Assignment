import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Use a slightly more relaxed tsconfig for tests
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
    }],
  },
  // Test isolation: each test file gets a fresh module registry
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  // Timeout for integration tests
  testTimeout: 30000,
};

export default config;
