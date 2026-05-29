const DEFAULT_WS_PORT = '5200';

type RuntimeEnv = Record<string, unknown>;

function isUnreachableBrowserHost(hostname: string) {
  const host = hostname.trim().toLowerCase();
  return host === '' || host === '0.0.0.0' || host === '::' || host === '127.0.0.1' || host === 'localhost';
}

function getString(env: RuntimeEnv, key: string) {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseHost(value: string) {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return value.includes(':') ? value.split(':')[0] : value;
  }
}

export function resolveWebsocketFallbackHost(env: RuntimeEnv = ((import.meta as any).env || {})) {
  return getString(env, 'VITE_TANGSENG_WS_HOST') ||
    getString(env, 'VITE_WS_HOST') ||
    parseHost(getString(env, 'VITE_TANGSENG_WS_URL')) ||
    parseHost(getString(env, 'VITE_WS_URL')) ||
    parseHost(getString(env, 'VITE_API_BASE_URL')) ||
    parseHost(getString(env, 'VITE_TANGSENG_API_BASE_URL')) ||
    globalThis.location?.hostname ||
    'localhost';
}

export function resolveWebsocketConnectAddr(rawAddr: unknown, fallbackHost?: string, env?: RuntimeEnv) {
  const host = fallbackHost || resolveWebsocketFallbackHost(env);
  const fallbackAddr = `ws://${host}:${DEFAULT_WS_PORT}`;
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
      url.hostname = host;
      if (!url.port) {
        url.port = DEFAULT_WS_PORT;
      }
    }
    return url.toString();
  } catch {
    return fallbackAddr;
  }
}
