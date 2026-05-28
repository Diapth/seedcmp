import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts', 'src/types/**']
    },
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '@tsdaodao/base-vue': path.resolve(__dirname, '../../packages/base-vue/src'),
      '@tsdaodao/datasource-vue': path.resolve(__dirname, '../../packages/datasource-vue/src'),
      '@tsdaodao/login-vue': path.resolve(__dirname, '../../packages/login-vue/src'),
      '@tsdaodao/contacts-vue': path.resolve(__dirname, '../../packages/contacts-vue/src')
    }
  }
})
