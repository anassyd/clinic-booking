import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks cache well between deploys
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: "motion", test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils|gsap|@gsap)[\\/]/ },
            { name: "ui", test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react|sonner|cmdk|react-day-picker)[\\/]/ },
            { name: "vendor", test: /node_modules/ },
          ],
        },
      },
    },
  },
  // Same-origin API in dev: no CORS, and the token never leaves localhost
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
  preview: {
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
