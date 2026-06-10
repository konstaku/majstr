import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './test/global-setup.js',
    setupFiles: ['./test/setup-env.js'],
    // One in-memory mongod, files run serially — keeps DB state simple.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 120000, // first run downloads the mongod binary
    include: ['test/**/*.test.js'],
  },
});
