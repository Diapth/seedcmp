import { describe, expect, it, vi } from 'vitest'

vi.mock('@tsdaodao/base-vue', async () => {
  const actual = await vi.importActual<typeof import('@tsdaodao/base-vue')>('@tsdaodao/base-vue')
  const { normalizeMediaUrl } = await vi.importActual<typeof import('../../../packages/base-vue/src/service/mediaUrl.ts')>('../../../packages/base-vue/src/service/mediaUrl.ts')
  return {
    ...actual,
    normalizeMediaUrl,
    apiClient: {
      defaults: {
        baseURL: 'http://im.example.com/v1/'
      },
      get: vi.fn(),
      post: vi.fn()
    },
    apiDelete: vi.fn()
  }
})

describe('media URL normalization', () => {
  it('rewrites loopback file service URLs to the configured media host', async () => {
    const { normalizeMediaUrl } = await import('../../../packages/base-vue/src/service/mediaUrl.ts')
    const mediaEnv = { VITE_API_BASE_URL: 'http://im.example.com/v1/' }

    expect(normalizeMediaUrl('http://127.0.0.1:8090/file/preview/chat/a.png', { env: mediaEnv })).toBe(
      'http://im.example.com:9000/chat/a.png'
    )
    expect(normalizeMediaUrl('http://localhost:8090/file/preview/chat/a.png', { env: mediaEnv })).toBe(
      'http://im.example.com:9000/chat/a.png'
    )
    expect(normalizeMediaUrl('http://127.0.0.1:8090/file/preview/chat/report.pdf', {
      env: mediaEnv
    })).toBe(
      'http://im.example.com:9000/chat/report.pdf'
    )
    expect(normalizeMediaUrl('http://127.0.0.1:9000/chat/report.pdf?download=1', {
      env: mediaEnv
    })).toBe(
      'http://im.example.com:9000/chat/report.pdf?download=1'
    )
    expect(normalizeMediaUrl('file/preview/chat/1/target/report.pdf', {
      baseUrl: 'http://im.example.com/v1/',
      env: mediaEnv
    })).toBe(
      'http://im.example.com:9000/chat/1/target/report.pdf'
    )
  })

  it('normalizes loopback media URLs at both store ingestion and clickable media cells', async () => {
    const store = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')
    const fileCell = await import('../../../packages/base-vue/src/components/messages/FileCell.vue?raw')
    const imageCell = await import('../../../packages/base-vue/src/components/messages/ImageCell.vue?raw')
    const voiceCell = await import('../../../packages/base-vue/src/components/messages/VoiceCell.vue?raw')
    const videoCell = await import('../../../packages/base-vue/src/components/messages/VideoCell.vue?raw')

    expect(store.default).toContain('normalizeMediaUrl')
    expect(store.default).toContain('normalized.url = normalizeMediaUrl')
    expect(fileCell.default).toContain('normalizeMediaUrl')
    expect(imageCell.default).toContain('normalizeMediaUrl')
    expect(voiceCell.default).toContain('normalizeMediaUrl')
    expect(videoCell.default).toContain('normalizeMediaUrl')
  })
})
