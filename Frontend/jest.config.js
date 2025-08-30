module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'src/backend/services/**/*.js',
        '!src/backend/services/**/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/utils/mock-setup.js'],
    testTimeout: 60000, // RAG 測試可能需要較長時間
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1'
    }
};