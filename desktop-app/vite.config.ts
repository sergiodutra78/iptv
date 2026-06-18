import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // CRÍTICO para que Electron encuentre los archivos locales relativos
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api/xtream': {
        target: 'http://latinchannel.tv:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/xtream/, '')
      },
      // Proxies para VOD y TV en formato HLS
      '/live': { target: 'http://latinchannel.tv:8080', changeOrigin: true },
      '/movie': { target: 'http://latinchannel.tv:8080', changeOrigin: true },
      '/series': { target: 'http://latinchannel.tv:8080', changeOrigin: true },
      '/hlsr': { target: 'http://latinchannel.tv:8080', changeOrigin: true }
    }
  }
})
