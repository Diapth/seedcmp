import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@tsdaodao/base-vue': path.resolve(__dirname, '../../packages/base-vue/src'),
      '@tsdaodao/datasource-vue': path.resolve(__dirname, '../../packages/datasource-vue/src'),
      '@tsdaodao/login-vue': path.resolve(__dirname, '../../packages/login-vue/src'),
      '@tsdaodao/contacts-vue': path.resolve(__dirname, '../../packages/contacts-vue/src')
    }
  },
  server: {
    port: 3000,
    host: true
  }
})
