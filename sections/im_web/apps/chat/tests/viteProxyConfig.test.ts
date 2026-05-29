import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('vite dev proxy config', () => {
  it('proxies the default /v1 API fallback to TangSeng instead of serving the SPA shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8')

    expect(source).toContain("'/v1'")
    expect(source).toContain("VITE_TANGSENG_PROXY_TARGET || 'http://127.0.0.1:8090'")
    expect(source).toContain('changeOrigin: true')
  })
})
