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

  it('rewrites local API and websocket env hosts when the browser opens IM Web through a remote host', () => {
    const env = {
      VITE_API_BASE_URL: 'http://127.0.0.1:8090/v1/',
      VITE_MEDIA_BASE_URL: 'http://127.0.0.1:8090',
      VITE_OBJECT_STORAGE_BASE_URL: 'http://127.0.0.1:9000',
      VITE_TANGSENG_WS_HOST: '127.0.0.1'
    }

    expect(resolveApiBaseUrl(env, '100.79.157.76')).toBe('http://100.79.157.76:8090/v1/')
    expect(resolveMediaOrigin(env, undefined, '100.79.157.76')).toBe('http://100.79.157.76:8090')
    expect(normalizeMediaUrl('/file/preview/chat/image.png', {
      baseUrl: 'http://127.0.0.1:8090/v1/',
      env,
      browserHostname: '100.79.157.76'
    })).toBe('http://100.79.157.76:9000/chat/image.png')
    expect(normalizeMediaUrl('http://localhost:3003/uploads/sinx.png', {
      baseUrl: 'http://127.0.0.1:8090/v1/',
      env,
      browserHostname: '100.79.157.76'
    })).toBe('http://100.79.157.76:3003/uploads/sinx.png')
    expect(normalizeMediaUrl('http://localhost:3004/uploads/sinx.png', {
      baseUrl: 'http://127.0.0.1:8090/v1/',
      env,
      browserHostname: '100.79.157.76'
    })).toBe('http://100.79.157.76:3004/uploads/sinx.png')
    expect(resolveWebsocketFallbackHost(env, '100.79.157.76')).toBe('100.79.157.76')
    expect(resolveWebsocketConnectAddr('ws://127.0.0.1:5200/', undefined, env, '100.79.157.76')).toBe(
      'ws://100.79.157.76:5200/'
    )
  })
})
