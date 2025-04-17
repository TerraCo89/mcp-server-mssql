// jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm', // Use the ESM preset
  testEnvironment: 'node',
  roots: ['<rootDir>/src'], // Look for tests within the src directory
  testMatch: [ // Pattern to match test files
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  // Explicitly configure transform for ts-jest with ESM support
  transform: {
    // Use ts-jest for .ts and .tsx files
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json', // Point to your tsconfig
        useESM: true, // Enable ESM support
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'], // Keep this
  // moduleNameMapper is needed for Node16/NodeNext module resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Add transformIgnorePatterns to prevent Jest from ignoring the SDK ESM module
  transformIgnorePatterns: [
    // This pattern ignores node_modules EXCEPT for @modelcontextprotocol/sdk
    '/node_modules/(?!@modelcontextprotocol/sdk/).+\\.(js|jsx|ts|tsx)$',
  ],
  // Optional: Setup files, coverage, etc. can be added here later
};