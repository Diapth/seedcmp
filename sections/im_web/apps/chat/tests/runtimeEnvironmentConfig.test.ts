import { describe, expect, it } from 'vitest'
import { normalizeMediaUrl, resolveMediaOrigin } from '../../../packages/base-vue/src/service/mediaUrl'
import { resolveApiBaseUrl } from '../../../packages/base-vue/src/service/APIClient'
import {
  resolveWebsocketConnectAddr,
  resolveWebsocketFallbackHost
} from '@tsdaodao/datasource-vue/stores/sdkAddress'

describe('runtime environment config', () => {
  it('resolves TangSeng API base URL from Vite environment variables', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: 'http://im.example.com/v1/' })).toBe('http://im.example.com/v1/')
    expect(resolveApiBaseUrl({ VITE_TANGSENG_API_BASE_URL: 'http://im.example.com/api' })).toBe('http://im.example.com/api/')
    expect(resolveApiBaseUrl({})).toBe('/v1/')
  })

  it('derives media and object preview URLs from environment instead of a fixed LAN host', () => {
    const env = {
      VITE_API_BASE_URL: 'http://im.example.com/v1/',
      VITE_OBJECT_STORAGE_BASE_URL: 'http://files.example.com'
    }

    expect(resolveMediaOrigin(env)).toBe('http://im.example.com')
    expect(normalizeMediaUrl('/file/preview/chat/report.pdf', { baseUrl: 'http://im.example.com/v1/', env })).toBe(
      'http://files.example.com/chat/report.pdf'
    )
  })

  it('uses environment fallback host for websocket addresses returned as localhost', () => {
    const env = { VITE_TANGSENG_WS_HOST: 'im-ws.example.com' }

    expect(resolveWebsocketFallbackHost(env)).toBe('im-ws.example.com')
    expect(resolveWebsocketConnectAddr('ws://127.0.0.1:5200/', undefined, env)).toBe('ws://im-ws.example.com:5200/')
  })
})
