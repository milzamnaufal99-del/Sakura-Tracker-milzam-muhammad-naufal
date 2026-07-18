import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom provides localStorage, document, window for unit/integration tests
    environment: 'jsdom',
    // Expose describe/it/expect/vi globally (no need to import in each test file)
    globals: true,
  },
});
