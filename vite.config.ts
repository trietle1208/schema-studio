import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'bridge/**/*.test.ts'],
    environment: 'node',
    // Node has no IndexedDB; the database tests run on an in-memory one.
    setupFiles: ['fake-indexeddb/auto'],
  },
});
