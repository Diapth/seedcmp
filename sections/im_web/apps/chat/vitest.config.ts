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
  }
})
