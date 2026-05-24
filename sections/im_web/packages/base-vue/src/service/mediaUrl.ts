const DEFAULT_LAN_MEDIA_ORIGIN = 'http://100.79.157.76:8090';
const DEFAULT_OBJECT_STORAGE_PORT = '9000';

function getEnvMediaOrigin() {
  const env = (import.meta as any).env || {};
  const origin = env.VITE_MEDIA_BASE_URL || env.VITE_FILE_BASE_URL;
  return origin ? String(origin).replace(/\/+$/, '') : '';
}

function getObjectStorageOrigin(mediaOrigin: string) {
  const env = (import.meta as any).env || {};
  const origin = env.VITE_OBJECT_STORAGE_BASE_URL || env.VITE_MINIO_BASE_URL;
  if (origin) return String(origin).replace(/\/+$/, '');
  try {
    const url = new URL(mediaOrigin);
    url.port = DEFAULT_OBJECT_STORAGE_PORT;
    return url.origin;
  } catch {
    return `http://100.79.157.76:${DEFAULT_OBJECT_STORAGE_PORT}`;
  }
}

function normalizePreviewUrl(url: URL, mediaOrigin: string) {
  const marker = '/file/preview/';
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) return '';
  const objectPath = url.pathname.slice(markerIndex + marker.length);
  const objectOrigin = getObjectStorageOrigin(mediaOrigin);
  const objectUrl = new URL(objectPath.replace(/^\/+/, ''), `${objectOrigin}/`);
  objectUrl.search = url.search;
  objectUrl.hash = url.hash;
  return objectUrl.toString();
}

export function normalizeMediaUrl(pathOrUrl: string, options: { baseUrl?: string; referenceUrl?: string } = {}) {
  if (!pathOrUrl) return '';

  const mediaOrigin = getEnvMediaOrigin() || (() => {
    try {
      const base = new URL(String(options.baseUrl || DEFAULT_LAN_MEDIA_ORIGIN));
      if ((base.hostname === '127.0.0.1' || base.hostname === 'localhost') && base.port === '8090') {
        return DEFAULT_LAN_MEDIA_ORIGIN;
      }
      return base.origin;
    } catch {
      return DEFAULT_LAN_MEDIA_ORIGIN;
    }
  })();

  if (/^https?:\/\//i.test(pathOrUrl)) {
    try {
      const url = new URL(pathOrUrl);
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        const target = new URL(mediaOrigin);
        url.protocol = target.protocol;
        url.hostname = target.hostname;
        if (url.port === '8090') {
          url.port = target.port;
        }
      }
      return normalizePreviewUrl(url, mediaOrigin) || url.toString();
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
    return normalizePreviewUrl(url, mediaOrigin) || url.toString();
  } catch {
    return pathOrUrl;
  }
}
