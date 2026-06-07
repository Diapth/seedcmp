const DEFAULT_H5_API_BASE = 'http://localhost:3000/v1/';
const DEFAULT_WS_BASE = '';

function readImportMetaEnv() {
  try {
    return import.meta?.env || {};
  } catch {
    return {};
  }
}

function normalizeBaseUrl(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function isLocalHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
}

export function rewriteLocalhostForRemoteBrowser(value) {
  if (!value) return value;
  const hostname = globalThis?.location?.hostname || '';
  if (!hostname || isLocalHost(hostname)) return value;
  try {
    const url = new URL(value);
    if (isLocalHost(url.hostname)) {
      url.hostname = hostname;
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function getRuntimeEnv() {
  const viteEnv = readImportMetaEnv();
  const processEnv = globalThis?.process?.env || {};
  const apiBase = normalizeBaseUrl(
    viteEnv.VITE_IM_WEB_API_BASE ||
      viteEnv.VITE_TANGSENG_API_BASE_URL ||
      viteEnv.VITE_API_BASE_URL ||
      processEnv.IM_WEB_API_BASE ||
      processEnv.VITE_IM_WEB_API_BASE ||
      DEFAULT_H5_API_BASE
  );

  return {
    IM_WEB_API_BASE: rewriteLocalhostForRemoteBrowser(apiBase),
    IM_WEB_WS_BASE: normalizeBaseUrl(
      viteEnv.VITE_IM_WEB_WS_BASE ||
        viteEnv.VITE_WS_BASE_URL ||
        processEnv.IM_WEB_WS_BASE ||
        DEFAULT_WS_BASE,
      DEFAULT_WS_BASE
    ),
    OAUTH_CLIENT_ID: String(viteEnv.VITE_OAUTH_CLIENT_ID || processEnv.OAUTH_CLIENT_ID || ''),
    IS_DEMO: String(viteEnv.VITE_AGENTHUB_DEMO || processEnv.AGENTHUB_DEMO || 'false') === 'true',
    PLATFORM: viteEnv.UNI_PLATFORM || processEnv.UNI_PLATFORM || 'h5'
  };
}

export const runtimeEnv = getRuntimeEnv();
export const IM_WEB_API_BASE = runtimeEnv.IM_WEB_API_BASE;
export const IM_WEB_WS_BASE = runtimeEnv.IM_WEB_WS_BASE;
export const OAUTH_CLIENT_ID = runtimeEnv.OAUTH_CLIENT_ID;
export const IS_DEMO = runtimeEnv.IS_DEMO;

export function joinUrl(base, path) {
  const normalizedBase = normalizeBaseUrl(base);
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return `${normalizedBase}${normalizedPath}`;
}
