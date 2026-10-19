import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { swPrecache } from './scripts/vite-sw-plugin.mjs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), swPrecache({ root: fileURLToPath(new URL('.', import.meta.url)) })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
