/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // mathjs (~1 MB) e plotly (~4,6 MB, carregado sob demanda) são grandes por natureza.
    chunkSizeWarningLimit: 5000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
