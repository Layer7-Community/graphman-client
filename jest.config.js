// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'modules/**/*.js',
    '!modules/graphman-extension-*.js', // Exclude extensions
    '!**/node_modules/**'
  ],
  
  // Coverage thresholds (optional)
  coverageThresholds: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',           // Console output
    'text-summary',   // Summary in console
    'html',           // HTML report in coverage/
    'lcov',           // LCOV format for CI/CD tools
    'json',           // JSON format
    'cobertura'       // Cobertura XML for Jenkins/Azure DevOps
  ],
  
  // Test reporters
  reporters: [
    'default',        // Standard Jest reporter
    [
      'jest-junit',   // JUnit XML reporter (needs to be installed)
      {
        outputDirectory: './test-reports',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],
  
  // Verbose output
  verbose: true,
  
  // Test timeout (30 seconds)
  testTimeout: 30000,
  
  // Setup files
  setupFilesAfterEnv: [],
  
  // Module paths
  modulePaths: ['<rootDir>'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Collect coverage information
  collectCoverage: false, // Set to true to always collect coverage
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/'
  ],
  
  // Coverage ignore patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/build/'
  ]
};

