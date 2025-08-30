import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  transpileDependencies: ['vuetify'],
  base: process.env.NODE_ENV === 'production' ? './' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer')
    }
  },
  server: {
    port: 3333,
    watch: {
      ignored: ['**/rag/**']  // 忽略 rag 資料夾，避免掃描 Python 檔
    }
  }
})
