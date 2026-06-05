import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const webDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDir, '../..');

export default defineConfig({
  envDir: repoRoot,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/audiotool': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000',
      '/ready': 'http://127.0.0.1:3000'
    }
  }
});
