import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const MODULE_DEFAULT_UPLOAD_DIR = resolve(THIS_DIR, '../../uploads');

/**
 * Resolve the upload directory.
 * Explicit UPLOAD_DIR keeps the historical cwd-based behavior.
 * Without configuration, default to packages/api/uploads so API routes and
 * connector outbound delivery share the same on-disk truth source.
 */
export function getDefaultUploadDir(configuredUploadDir?: string): string {
  return configuredUploadDir ? resolve(configuredUploadDir) : MODULE_DEFAULT_UPLOAD_DIR;
}

const INTERNAL_ROUTE_PREFIXES = ['/uploads/', '/api/connector-media/', '/api/tts/audio/'];

function normalizeBaseUrl(value?: string): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '');
  return trimmed ? trimmed : null;
}

function resolveInternalRouteBaseUrl(): string {
  const explicitPublicUrl =
    normalizeBaseUrl(process.env.CAT_CAFE_PUBLIC_URL) ??
    normalizeBaseUrl(process.env.CAT_CAFE_WEB_URL) ??
    normalizeBaseUrl(process.env.FRONTEND_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_FRONTEND_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (explicitPublicUrl) return explicitPublicUrl;

  const apiUrl = normalizeBaseUrl(process.env.CAT_CAFE_API_URL) ?? normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  if (apiUrl) return apiUrl;

  const frontendPort = Number(process.env.FRONTEND_PORT);
  if (Number.isInteger(frontendPort) && frontendPort > 0) return `http://localhost:${frontendPort}`;

  return 'http://localhost:3003';
}

export function resolveInternalRouteUrl(url: string): string {
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  if (INTERNAL_ROUTE_PREFIXES.some((p) => url.startsWith(p))) {
    return `${resolveInternalRouteBaseUrl()}${url}`;
  }
  return url;
}
