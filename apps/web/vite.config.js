import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const webDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDir, '../..');
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000';

export default defineConfig({
  envDir: repoRoot,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/audiotool': apiProxyTarget,
      '/convert': apiProxyTarget,
      '/health': apiProxyTarget,
      '/ready': apiProxyTarget
    }
  }
});
