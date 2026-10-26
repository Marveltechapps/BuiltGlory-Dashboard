import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const api = loadEnv(mode, process.cwd(), '').VITE_API_URL || 'http://localhost:5001';
  return {
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: api, changeOrigin: true },
        '/socket.io': { target: api, changeOrigin: true, ws: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('socket.io') || id.includes('engine.io')) return 'socket';
            if (id.includes('@tanstack')) return 'query';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\') || id.includes('scheduler')) return 'react';
            return undefined;
          },
        },
      },
    },
  };
});
