/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'], // backend/test/ (scenario fixtures) is added in Phase 2
  testMatch: ['**/*.spec.ts'],
};
