import { describe, expect, it } from 'vitest'
import { resolveWebsocketConnectAddr } from '@tsdaodao/datasource-vue/stores/sdkAddress'

describe('resolveWebsocketConnectAddr', () => {
  it('replaces browser-unreachable hosts with the fallback host', () => {
    expect(resolveWebsocketConnectAddr('ws://0.0.0.0:5200', '100.79.157.76')).toBe('ws://100.79.157.76:5200/')
    expect(resolveWebsocketConnectAddr('ws://127.0.0.1:5200/', '100.79.157.76')).toBe('ws://100.79.157.76:5200/')
    expect(resolveWebsocketConnectAddr('ws://localhost:5200/', '100.79.157.76')).toBe('ws://100.79.157.76:5200/')
  })

  it('keeps reachable ws and wss addresses', () => {
    expect(resolveWebsocketConnectAddr('ws://im.example.com:5200', '100.79.157.76')).toBe('ws://im.example.com:5200/')
    expect(resolveWebsocketConnectAddr('wss://im.example.com/ws', '100.79.157.76')).toBe('wss://im.example.com/ws')
  })

  it('falls back for empty, malformed, or non-websocket addresses', () => {
    expect(resolveWebsocketConnectAddr('', '100.79.157.76')).toBe('ws://100.79.157.76:5200')
    expect(resolveWebsocketConnectAddr('https://im.example.com', '100.79.157.76')).toBe('ws://100.79.157.76:5200')
    expect(resolveWebsocketConnectAddr('not a url', '100.79.157.76')).toBe('ws://100.79.157.76:5200')
  })
})
