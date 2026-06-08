import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'

// Handle ESM default import mismatch
const uni = uniPlugin.default || uniPlugin

function normalizeTarget(value) {
  return String(value || 'http://127.0.0.1:8090').replace(/\/+$/, '')
}

function shouldCompatSettingRequest(req) {
  return req.method === 'PUT' && /^\/v1\/(?:users\/[^/]+|groups\/[^/]+)\/setting(?:\?|$)/.test(req.url || '')
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function requestHeadersForBackend(req) {
  const headers = {}
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (['host', 'connection', 'content-length'].includes(key.toLowerCase())) continue
    if (value === undefined) continue
    headers[key] = Array.isArray(value) ? value.join(',') : value
  }
  return headers
}

function tangSengSettingCompatPlugin() {
  return {
    name: 'tangseng-setting-compat',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!shouldCompatSettingRequest(req)) {
          next()
          return
        }

        try {
          const body = await readRequestBody(req)
          const target = normalizeTarget(process.env.VITE_TANGSENG_PROXY_TARGET)
          const backendResp = await fetch(`${target}${req.url}`, {
            method: req.method,
            headers: requestHeadersForBackend(req),
            body
          })
          const text = await backendResp.text()
          let data = null
          try {
            data = text ? JSON.parse(text) : null
          } catch {
            data = null
          }

          if (backendResp.status === 400 && /发送频道更新命令失败/.test(String(data?.msg || data?.message || text))) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              settingPersisted: true,
              commandNotifyFailed: true
            }))
            return
          }

          res.statusCode = backendResp.status
          backendResp.headers.forEach((value, key) => {
            if (!['content-encoding', 'content-length'].includes(key.toLowerCase())) {
              res.setHeader(key, value)
            }
          })
          res.end(text)
        } catch (error) {
          next(error)
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [
    tangSengSettingCompatPlugin(),
    uni()
  ],
  server: {
    host: true,
    watch: {
      ignored: [
        '**/.agents/**',
        '**/.hbuilderx/**',
        '**/.specify/**',
        '**/dist/**',
        '**/unpackage/**',
        '**/issues/**',
        '**/screenshots/**',
        '**/test-results/**',
        '**/tests-e2e/**',
        '**/coverage/**'
      ]
    },
    proxy: {
      '/v1': {
        target: process.env.VITE_TANGSENG_PROXY_TARGET || 'http://127.0.0.1:8090',
        changeOrigin: true
      },
      '/clowder-api': {
        target: process.env.VITE_CLOWDER_PROXY_TARGET || 'http://127.0.0.1:3004',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/clowder-api/, '')
      }
    }
  },
  build: {
    minify: false,
    sourcemap: true
  },
  optimizeDeps: {
    include: ['mammoth/mammoth.browser', 'jszip', 'pdfjs-dist', 'katex']
  }
})
