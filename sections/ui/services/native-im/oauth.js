function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function oauthProviderForPlatform(platform = '') {
  const value = firstNonEmpty(platform).toLowerCase();
  if (value.includes('claude') || value.includes('anthropic')) return 'claude';
  return 'codex';
}

export function defaultOAuthAccountRef(platform = '') {
  return oauthProviderForPlatform(platform);
}

export function normalizeLocalOAuthCapabilities(resp = {}) {
  if (resp.codex || resp.claude) {
    return ['codex', 'claude'].reduce((acc, provider) => {
      if (!resp[provider]) return acc;
      const entry = resp[provider];
      acc[provider] = {
        provider,
        authConfigured: entry.authConfigured === true,
        configPresent: entry.configPresent === true,
        configFiles: firstArray(entry.configFiles),
        defaultModel: firstNonEmpty(entry.defaultModel),
        profile: firstNonEmpty(entry.profile),
        diagnostics: firstArray(entry.diagnostics).map(String).filter(Boolean),
        raw: entry.raw || entry
      };
      return acc;
    }, {});
  }
  const providers = firstArray(resp.providers, resp.data?.providers, resp.data);
  return providers.reduce((acc, entry) => {
    const provider = firstNonEmpty(entry?.provider, entry?.name).toLowerCase();
    if (!provider) return acc;
    acc[provider] = {
      provider,
      authConfigured: entry?.authConfigured === true || entry?.auth_configured === true,
      configPresent: entry?.configPresent === true || entry?.config_present === true,
      configFiles: firstArray(entry?.configFiles, entry?.config_files),
      defaultModel: firstNonEmpty(entry?.defaultModel, entry?.default_model),
      profile: firstNonEmpty(entry?.profile),
      diagnostics: firstArray(entry?.diagnostics).map(String).filter(Boolean),
      raw: entry
    };
    return acc;
  }, {});
}

export function createLocalOAuthCapabilityLoader(fetchCapabilities) {
  let inflight = null;
  const state = {
    capabilities: {},
    loading: false,
    error: '',
    loaded: false
  };

  async function load(options = {}) {
    if (inflight && !options.force) return inflight;
    if (state.loaded && !options.force) return state.capabilities;
    state.loading = true;
    state.error = '';
    inflight = Promise.resolve()
      .then(() => fetchCapabilities())
      .then((resp) => {
        state.capabilities = normalizeLocalOAuthCapabilities(resp || {});
        state.loaded = true;
        state.error = '';
        return state.capabilities;
      })
      .catch((error) => {
        state.error = firstNonEmpty(error?.msg, error?.message, '本机 OAuth 配置检查失败');
        state.loaded = false;
        throw error;
      })
      .finally(() => {
        state.loading = false;
        inflight = null;
      });
    return inflight;
  }

  function reset() {
    state.capabilities = {};
    state.loading = false;
    state.error = '';
    state.loaded = false;
    inflight = null;
  }

  return {
    state,
    load,
    reset
  };
}

export function resolveLocalOAuthStatus({
  accessMode = '',
  platform = '',
  capabilities = {},
  loading = false,
  error = ''
} = {}) {
  const provider = oauthProviderForPlatform(platform);
  const providerLabel = provider === 'claude' ? 'Claude Code' : 'Codex';
  const loginCommand = provider === 'claude' ? 'claude login' : 'codex login';
  const base = {
    provider,
    providerLabel,
    loginCommand,
    capability: null,
    message: '',
    detail: '',
    canCreate: false
  };

  if (String(accessMode || '').toLowerCase() !== 'oauth') {
    return {
      ...base,
      state: 'idle',
      canCreate: true
    };
  }
  if (loading) {
    return {
      ...base,
      state: 'loading',
      message: '正在检查本机 CLI 配置'
    };
  }
  if (error) {
    return {
      ...base,
      state: 'error',
      message: `本机 OAuth 配置检查失败：${String(error)}`
    };
  }

  const capability = capabilities[provider] || null;
  if (!capability?.authConfigured) {
    return {
      ...base,
      state: 'missing',
      capability,
      message: firstArray(capability?.diagnostics)[0]
        || `未检测到${providerLabel}本机登录，请先运行 ${loginCommand}`
    };
  }

  const detailParts = [];
  if (capability.profile) detailParts.push(`配置档：${capability.profile}`);
  if (capability.defaultModel) detailParts.push(`CLI 默认模型：${capability.defaultModel}`);
  return {
    ...base,
    state: 'ready',
    capability,
    canCreate: true,
    message: `已检测到 ${providerLabel} 本机登录，创建时使用 CLI 默认配置`,
    detail: detailParts.join(' · ')
  };
}
