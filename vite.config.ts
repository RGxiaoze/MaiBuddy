/// <reference types="vitest/config" />
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://www.diving-fish.com',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
      '/alias-api': {
        target: 'https://www.yuzuchan.moe',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/alias-api/, '/api'),
      },
    },
  },
})
