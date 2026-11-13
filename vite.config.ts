import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  define: { 'import.meta.env.MIAODA_CLIENT_BASE_PATH': JSON.stringify('/') },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: { outDir: 'dist', sourcemap: false },
  server: { proxy: { '/api': 'http://127.0.0.1:28789' } },
});
