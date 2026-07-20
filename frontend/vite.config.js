import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  server: {
    port: 3000,
    // Para acceso remoto vía Tailscale, descomentar:
    // allowedHosts: ['spooky.tail0d213e.ts.net'],
    // hmr: { host: 'spooky.tail0d213e.ts.net', protocol: 'wss', clientPort: 443 },
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
