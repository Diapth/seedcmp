import { IM_WEB_API_BASE, joinUrl } from './env.js';
import { storage } from './storage.js';

export class AppError extends Error {
  constructor(message, options = {}) {
    super(message || '请求失败');
    this.name = 'AppError';
    this.status = options.status || 0;
    this.code = options.code ?? options.status ?? 'APP_ERROR';
    this.payload = options.payload;
    this.url = options.url || '';
    this.isAppError = true;
  }
}

let requestAdapter = null;
let authTokenProvider = () => storage.get('auth.accessToken') || storage.get('app_token') || '';
let refreshHandler = null;
let kickoutHandler = null;

function normalizeHeaders(headers = {}) {
  return Object.entries(headers).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') acc[key] = value;
    return acc;
  }, {});
}

function normalizeMethod(method = 'GET') {
  return String(method || 'GET').toUpperCase();
}

function normalizeResponse(raw, url) {
  const status = Number(raw?.status ?? raw?.statusCode ?? 0);
  const payload = raw?.data ?? raw;
  const headers = raw?.headers || raw?.header || {};
  if (status >= 400 || status === 401) {
    const message = payload?.msg || payload?.message || payload?.error || `请求失败 (${status})`;
    throw new AppError(message, {
      status,
      code: payload?.code ?? status,
      payload,
      url
    });
  }

  if (payload && typeof payload === 'object' && 'code' in payload) {
    const code = payload.code;
    if (!(code === 0 || code === '0' || code === 'OK' || code === 'ok')) {
      throw new AppError(payload.msg || payload.message || '业务请求失败', {
        status,
        code,
        payload,
        url
      });
    }
    return { data: payload.data ?? payload, status, headers, raw: payload };
  }

  return { data: payload, status, headers, raw: payload };
}

async function fetchAdapter(options) {
  if (typeof fetch === 'undefined') {
    throw new AppError('当前运行时不支持 fetch，且 uni.request 不可用', { url: options.url });
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller && options.timeout
    ? setTimeout(() => controller.abort(), options.timeout)
    : null;
  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.data === undefined || options.method === 'GET' ? undefined : JSON.stringify(options.data),
      signal: controller?.signal
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    return {
      status: response.status,
      data,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new AppError('请求超时', { code: 'TIMEOUT', url: options.url });
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function uniAdapter(options) {
  return new Promise((resolve, reject) => {
    if (typeof uni === 'undefined' || !uni.request) {
      fetchAdapter(options).then(resolve).catch(reject);
      return;
    }

    uni.request({
      url: options.url,
      method: options.method,
      data: options.data,
      header: options.headers,
      timeout: options.timeout,
      success: (res) => resolve(res),
      fail: (err) => reject(new AppError(err?.errMsg || '网络请求失败', { code: 'NETWORK_ERROR', url: options.url, payload: err }))
    });
  });
}

async function runAdapter(options) {
  const adapter = requestAdapter || uniAdapter;
  return adapter(options);
}

function isKickoutError(err) {
  return err?.status === 401 && (err?.code === 'kicked' || err?.payload?.code === 'kicked');
}

export async function request(path, options = {}) {
  const method = normalizeMethod(options.method);
  const url = joinUrl(options.baseURL || IM_WEB_API_BASE, path);
  const token = options.skipAuth ? '' : authTokenProvider();
  const headers = normalizeHeaders({
    'Content-Type': options.formData ? undefined : 'application/json',
    ...options.headers,
    token,
    Authorization: token ? `Bearer ${token}` : undefined
  });

  const requestOptions = {
    url,
    method,
    data: options.data,
    headers,
    timeout: options.timeout || 15000
  };

  try {
    return normalizeResponse(await runAdapter(requestOptions), url);
  } catch (err) {
    const appError = err instanceof AppError
      ? err
      : new AppError(err?.message || '请求失败', { code: err?.code, payload: err, url });

    if (isKickoutError(appError)) {
      if (kickoutHandler) kickoutHandler(appError);
      throw appError;
    }

    if (appError.status === 401 && !options._retried && !options.skipRefresh && refreshHandler) {
      try {
        await refreshHandler();
        return request(path, { ...options, _retried: true });
      } catch (refreshErr) {
        if (kickoutHandler) kickoutHandler(refreshErr);
        throw refreshErr instanceof AppError
          ? refreshErr
          : new AppError(refreshErr?.message || '登录已失效', { status: 401, code: 'AUTH_EXPIRED', url });
      }
    }

    throw appError;
  }
}

export function apiDelete(path, data, options = {}) {
  return request(path, { ...options, method: 'DELETE', data });
}

export function setRequestAdapter(adapter) {
  requestAdapter = adapter;
}

export function setAuthTokenProvider(provider) {
  authTokenProvider = provider;
}

export function setRefreshHandler(handler) {
  refreshHandler = handler;
}

export function setKickoutHandler(handler) {
  kickoutHandler = handler;
}

export function resetRequestRuntimeForTests() {
  requestAdapter = null;
  authTokenProvider = () => storage.get('auth.accessToken') || storage.get('app_token') || '';
  refreshHandler = null;
  kickoutHandler = null;
}
