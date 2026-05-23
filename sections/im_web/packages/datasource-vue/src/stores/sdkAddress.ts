const DEFAULT_WS_HOST = '100.79.157.76';
const DEFAULT_WS_PORT = '5200';

function isUnreachableBrowserHost(hostname: string) {
  const host = hostname.trim().toLowerCase();
  return host === '' || host === '0.0.0.0' || host === '::' || host === '127.0.0.1' || host === 'localhost';
}

export function resolveWebsocketConnectAddr(rawAddr: unknown, fallbackHost = DEFAULT_WS_HOST) {
  const fallbackAddr = `ws://${fallbackHost}:${DEFAULT_WS_PORT}`;
  if (typeof rawAddr !== 'string' || rawAddr.trim() === '') {
    return fallbackAddr;
  }

  const trimmed = rawAddr.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      return fallbackAddr;
    }
    if (isUnreachableBrowserHost(url.hostname)) {
      url.hostname = fallbackHost;
      if (!url.port) {
        url.port = DEFAULT_WS_PORT;
      }
    }
    return url.toString();
  } catch {
    return fallbackAddr;
  }
}
