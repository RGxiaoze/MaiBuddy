/// <reference types="vitest/config" />
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ENABLE_DIMENSION_ANALYSIS } from './src/config/features'

// https://vite.dev/config/
export default defineConfig({
  base: '/MaiBuddy/',
  test: {
    include: ['src/**/*.test.ts'],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    // 数组形式：精确规则必须排在 '@' 前缀规则之前才会先命中
    alias: [
      // 板块关闭时把页面模块换成空实现，真实算法不会进入打包产物
      ...(ENABLE_DIMENSION_ANALYSIS
        ? []
        : [{ find: /^@\/pages\/DimensionAnalysis$/, replacement: resolve(__dirname, 'src/config/disabledPage.ts') }]),
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
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
