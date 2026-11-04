import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { rollupOptions: { output: { chunkFileNames: 'assets/chunk-[name]-[hash].js' } } },
  server: { proxy: { '/api': 'http://localhost:8063', '/oauth2': 'http://localhost:8160' } },
});
