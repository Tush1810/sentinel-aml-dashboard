import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API is proxied so the browser talks to one origin and the backend needs no CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:8081', changeOrigin: true },
    },
  },
})
