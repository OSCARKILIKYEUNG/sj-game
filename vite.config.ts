import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/sj-game/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
  },
});
