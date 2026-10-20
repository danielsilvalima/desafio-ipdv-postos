import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/setup/config.js';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: ['tests/setup/banco-de-teste.ts'],
    // Os testes de integração compartilham o mesmo banco.
    fileParallelism: false,
  },
});
