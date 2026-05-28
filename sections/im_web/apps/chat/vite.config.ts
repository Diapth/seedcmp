import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],
    alias: [
      { find: /^@tsdaodao\/base-vue$/, replacement: path.resolve(__dirname, '../../packages/base-vue/src/index.ts') },
      { find: /^@tsdaodao\/base-vue\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/base-vue/src/$1') },
      { find: /^@tsdaodao\/datasource-vue$/, replacement: path.resolve(__dirname, '../../packages/datasource-vue/src/index.ts') },
      { find: /^@tsdaodao\/datasource-vue\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/datasource-vue/src/$1') },
      { find: /^@tsdaodao\/login-vue$/, replacement: path.resolve(__dirname, '../../packages/login-vue/src/index.ts') },
      { find: /^@tsdaodao\/login-vue\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/login-vue/src/$1') },
      { find: /^@tsdaodao\/contacts-vue$/, replacement: path.resolve(__dirname, '../../packages/contacts-vue/src/index.ts') },
      { find: /^@tsdaodao\/contacts-vue\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/contacts-vue/src/$1') }
    ]
  },
  server: {
    port: 3000,
    host: true
  }
})
