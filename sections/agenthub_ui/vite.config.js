import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'

// Handle ESM default import mismatch
const uni = uniPlugin.default || uniPlugin

export default defineConfig({
  plugins: [
    uni()
  ],
  server: {
    port: 5173,
    host: true
  },
  build: {
    minify: false,
    sourcemap: true
  },
  optimizeDeps: {
    include: ['mammoth/mammoth.browser', 'jszip', 'pdfjs-dist', 'katex']
  }
})
