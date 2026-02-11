import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      host: 'localhost',
      clientPort: 3000,
    },
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('[Proxy] Request:', req.method, req.url, '→', 'http://backend:8000' + req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('[Proxy] Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/auth': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
