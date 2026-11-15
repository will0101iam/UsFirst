import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'usfirst-shell-cache',
    apply: 'build',
    closeBundle() {
      const output = path.resolve(import.meta.dirname, 'dist');
      const indexPath = path.join(output, 'index.html');
      const html = readFileSync(indexPath, 'utf8');
      const assets = [...readdirSync(path.join(output, 'assets')).map(name => './assets/' + name), './boot.js', './manifest.webmanifest', './app-icon-192.png', './app-icon-512.png', './app-icon.svg'];
      const hash = createHash('sha256').update(html);
      for (const asset of assets) hash.update(readFileSync(path.join(output, asset)));
      const template = readFileSync(path.resolve(import.meta.dirname, 'scripts/service-worker-template.js'), 'utf8');
      hash.update(template);
      const version = hash.digest('hex').slice(0, 16);
      writeFileSync(indexPath, html.replace('</head>', `<meta name="usfirst-build" content="${version}" /></head>`));
      writeFileSync(path.join(output, 'sw.js'), template.replace('__SHELL_VERSION__', JSON.stringify(version)).replace('__SHELL_ASSETS__', JSON.stringify(assets)));
    },
  }],
  base: '/',
  define: { 'import.meta.env.MIAODA_CLIENT_BASE_PATH': JSON.stringify('/') },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: { outDir: 'dist', sourcemap: false },
  server: { proxy: { '/api': 'http://127.0.0.1:28789' } },
});
