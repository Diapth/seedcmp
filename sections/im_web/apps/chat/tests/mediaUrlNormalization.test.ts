import { describe, expect, it, vi } from 'vitest'

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    defaults: {
      baseURL: 'http://100.79.157.76:8090/v1/'
    },
    get: vi.fn(),
    post: vi.fn()
  },
  apiDelete: vi.fn()
}))

describe('media URL normalization', () => {
  it('rewrites loopback file service URLs to the LAN-accessible media host', async () => {
    const { resolveApiAssetUrl } = await import('../../../packages/datasource-vue/src/api/index.ts')

    expect(resolveApiAssetUrl('http://127.0.0.1:8090/file/preview/chat/a.png')).toBe(
      'http://100.79.157.76:8090/file/preview/chat/a.png'
    )
    expect(resolveApiAssetUrl('http://localhost:8090/file/preview/chat/a.png')).toBe(
      'http://100.79.157.76:8090/file/preview/chat/a.png'
    )
  })
})
