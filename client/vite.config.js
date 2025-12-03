import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https: false, // Frontend runs on HTTP, backend handles HTTPS
    hmr: {
      port: 5173,
      clientPort: 5173,
    },
    proxy: {
      '/api': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        rewrite: (path) => path,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.warn('Proxy error:', err.message);
            console.warn('Make sure the backend server is running on https://localhost:8443');
          });
        }
      },
      '/socket.io': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        ws: true, // Enable WebSocket proxying
        rewrite: (path) => path
      }
    }
  }
});

