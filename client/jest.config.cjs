module.exports = {
  testEnvironment: 'jsdom',
  rootDir: '.',
  testMatch: ['**/tests/e2e/**/*.test.js', '**/tests/attacks/**/*.test.js', '**/tests/file-*.test.js'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  setupFiles: ['<rootDir>/jest.globals.cjs'], // Run FIRST, before any modules
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@peculiar/webcrypto|fake-indexeddb)/)',
  ],
  moduleNameMapper: {
    '\\.(css|scss)$': 'identity-obj-proxy',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  verbose: true,
  // Increase timeout for E2EE tests (crypto operations can be slow)
  testTimeout: 30000, // 30 seconds
};


