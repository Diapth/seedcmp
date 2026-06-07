function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function joinUrl(baseUrl, path) {
  const base = String(baseUrl || '').trim();
  const normalizedPath = trimSlashes(path);
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  if (!base) return `/${normalizedPath}`;
  return `${base.replace(/\/+$/, '')}/${normalizedPath}`;
}

function uniRequest(options) {
  return new Promise((resolve, reject) => {
    if (typeof uni === 'undefined' || typeof uni.request !== 'function') {
      reject(new Error('uni.request is unavailable'));
      return;
    }
    uni.request({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

export function isAuthExpiredError(error = {}) {
  const status = Number(error.status || error.statusCode || 0);
  const message = String(error.msg || error.message || '');
  return status === 401 || /请先登录|token不能为空|token有误|登录已过期|unauthorized/i.test(message);
}

export function createNativeApiClient(options = {}) {
  const baseUrl = options.baseUrl || '/v1/';
  const getToken = options.getToken || (() => '');
  const request = options.request || uniRequest;

  async function call(method, path, data, config = {}) {
    const token = getToken();
    const header = {
      'Content-Type': 'application/json',
      ...(config.header || {})
    };
    if (token) header.token = token;

    const response = await request({
      url: joinUrl(baseUrl, path),
      method,
      data,
      header,
      timeout: config.timeout || 10000
    });
    const statusCode = response.statusCode || response.status || 0;
    const body = response.data;
    if (statusCode >= 200 && statusCode < 300) {
      return body;
    }
    const message = body?.msg || body?.message || `请求失败 (${statusCode})`;
    throw {
      msg: message,
      status: statusCode,
      authExpired: isAuthExpiredError({ status: statusCode, msg: message }),
      error: response
    };
  }

  return {
    get(path, params, config) {
      const query = params && Object.keys(params).length
        ? `?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null)).toString()}`
        : '';
      return call('GET', `${path}${query}`, undefined, config);
    },
    post(path, data, config) {
      return call('POST', path, data, config);
    },
    put(path, data, config) {
      return call('PUT', path, data, config);
    },
    delete(path, data, config) {
      return call('DELETE', path, data, config);
    }
  };
}
