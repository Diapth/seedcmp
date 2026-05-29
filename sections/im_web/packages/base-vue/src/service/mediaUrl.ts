const DEFAULT_OBJECT_STORAGE_PORT = '9000';

type RuntimeEnv = Record<string, unknown>;

function runtimeEnv() {
  return ((import.meta as any).env || {}) as RuntimeEnv;
}

function getString(env: RuntimeEnv, key: string) {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function stripApiPath(originOrBase: string) {
  try {
    const url = new URL(originOrBase);
    if (url.pathname === '/v1' || url.pathname === '/v1/') {
      url.pathname = '/';
    }
    url.search = '';
    url.hash = '';
    return url.origin;
  } catch {
    return '';
  }
}

export function resolveMediaOrigin(env: RuntimeEnv = runtimeEnv(), baseUrl?: string) {
  const origin = env.VITE_MEDIA_BASE_URL || env.VITE_FILE_BASE_URL;
  if (origin) return String(origin).replace(/\/+$/, '');

  const apiBase = getString(env, 'VITE_API_BASE_URL') ||
    getString(env, 'VITE_TANGSENG_API_BASE_URL') ||
    getString(env, 'VITE_IM_WEB_API_BASE_URL');
  return stripApiPath(apiBase) ||
    stripApiPath(baseUrl || '') ||
    (globalThis.location?.origin || '');
}

function getObjectStorageOrigin(mediaOrigin: string, env: RuntimeEnv) {
  const origin = env.VITE_OBJECT_STORAGE_BASE_URL || env.VITE_MINIO_BASE_URL;
  if (origin) return String(origin).replace(/\/+$/, '');
  try {
    const url = new URL(mediaOrigin);
    url.port = DEFAULT_OBJECT_STORAGE_PORT;
    return url.origin;
  } catch {
    return mediaOrigin;
  }
}

function normalizePreviewUrl(url: URL, mediaOrigin: string, env: RuntimeEnv) {
  const marker = '/file/preview/';
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) return '';
  const objectPath = url.pathname.slice(markerIndex + marker.length);
  const objectOrigin = getObjectStorageOrigin(mediaOrigin, env);
  const objectUrl = new URL(objectPath.replace(/^\/+/, ''), `${objectOrigin}/`);
  objectUrl.search = url.search;
  objectUrl.hash = url.hash;
  return objectUrl.toString();
}

export function normalizeMediaUrl(
  pathOrUrl: string,
  options: { baseUrl?: string; referenceUrl?: string; env?: RuntimeEnv } = {}
) {
  if (!pathOrUrl) return '';

  const env = options.env || runtimeEnv();
  const mediaOrigin = resolveMediaOrigin(env, options.baseUrl);

  if (/^https?:\/\//i.test(pathOrUrl)) {
    try {
      const url = new URL(pathOrUrl);
      if (mediaOrigin && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) {
        const target = new URL(mediaOrigin);
        url.protocol = target.protocol;
        url.hostname = target.hostname;
        if (url.port === '8090') {
          url.port = target.port;
        }
      }
      return normalizePreviewUrl(url, mediaOrigin, env) || url.toString();
    } catch {
      return pathOrUrl;
    }
  }

  let baseUrl = options.baseUrl || '/';
  if (options.referenceUrl && /^https?:\/\//i.test(options.referenceUrl)) {
    try {
      const uploadUrl = new URL(options.referenceUrl);
      const markerIndex = uploadUrl.pathname.indexOf('/file/upload');
      uploadUrl.pathname = markerIndex >= 0 ? uploadUrl.pathname.slice(0, markerIndex + 1) : uploadUrl.pathname.replace(/[^/]*$/, '');
      uploadUrl.search = '';
      uploadUrl.hash = '';
      baseUrl = uploadUrl.toString();
    } catch {
      // Fall back to the provided base URL below.
    }
  }

  try {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const url = new URL(pathOrUrl.replace(/^\/+/, ''), normalizedBase);
    return normalizePreviewUrl(url, mediaOrigin, env) || url.toString();
  } catch {
    return pathOrUrl;
  }
}
