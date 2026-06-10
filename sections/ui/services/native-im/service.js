import { createNativeApiClient } from './api-client.js';
import {
  normalizeNativeGroup,
  normalizeNativeGroupMember
} from './conversation-state.js';
import {
  normalizeConversation,
  normalizeFriend,
  normalizeFriendRequest,
  normalizeFriendSearchResult,
  normalizeMessage
} from './normalizers.js';
import {
  defaultOAuthAccountRef,
  normalizeLocalOAuthCapabilities
} from './oauth.js';
import {
  normalizeMarketplaceSkillList,
  normalizeUserSkill,
  normalizeUserSkillList
} from './skill-state.js';
import {
  normalizeDeploymentRequest
} from './deployment.js';

const CHANNEL_TYPE_PERSON = 1;
const CHANNEL_TYPE_GROUP = 2;

function readStorage(key, fallback = '') {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return fallback;
  try {
    const value = uni.getStorageSync(key);
    return value === undefined || value === null || value === '' ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') return;
  try {
    uni.setStorageSync(key, value);
  } catch {
    // storage failures should not break an IM session bootstrap
  }
}

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function joinServiceUrl(baseUrl, path) {
  const base = String(baseUrl || '').trim();
  const normalizedPath = trimSlashes(path);
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  if (!base) return `/${normalizedPath}`;
  return `${base.replace(/\/+$/, '')}/${normalizedPath}`;
}

function resolveDefaultBaseUrl() {
  const env = import.meta.env || {};
  return readStorage('native_api_base_url')
    || env.VITE_TANGSENG_API_BASE_URL
    || env.VITE_API_BASE_URL
    || '/v1/';
}

function resolveDefaultClowderBaseUrl() {
  const env = import.meta.env || {};
  return readStorage('clowder_api_base_url')
    || env.VITE_CLOWDER_API_BASE_URL
    || '/clowder-api/api/';
}

function randomHexId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const next = char === 'x' ? value : (value & 0x3) | 0x8;
    return next.toString(16);
  });
}

function defaultDeviceFactory() {
  const deviceId = readStorage('native_device_id') || randomHexId();
  writeStorage('native_device_id', deviceId);
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const deviceName = /Windows/i.test(userAgent)
    ? 'Windows'
    : /Mac OS/i.test(userAgent)
      ? 'MacOS'
      : /Android/i.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/i.test(userAgent)
          ? 'iOS'
          : 'Web';
  const deviceModel = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/?([\d.]+)?/i)?.[0] || 'Browser';
  return {
    device_id: deviceId,
    device_name: deviceName,
    device_model: deviceModel
  };
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function channelKey(channelId, channelType) {
  return `${String(channelId || '')}-${Number(channelType || CHANNEL_TYPE_PERSON)}`;
}

function buildChannelInfoMap(resp = {}) {
  const map = new Map();
  firstArray(resp.users, resp.data?.users).forEach((user) => {
    const uid = String(user.uid || user.id || user.user_id || '');
    if (uid) map.set(channelKey(uid, CHANNEL_TYPE_PERSON), user);
  });
  firstArray(resp.groups, resp.data?.groups).forEach((group) => {
    const id = String(group.group_no || group.groupNo || group.channel_id || group.id || '');
    if (id) map.set(channelKey(id, CHANNEL_TYPE_GROUP), group);
  });
  return map;
}

function normalizeSession(loginResp = {}) {
  const user = {
    id: String(loginResp.uid || loginResp.id || loginResp.user_id || ''),
    uid: String(loginResp.uid || loginResp.id || loginResp.user_id || ''),
    nickname: loginResp.name || loginResp.nickname || loginResp.uid || '',
    name: loginResp.name || loginResp.nickname || '',
    avatar: loginResp.avatar || loginResp.logo || '',
    phone: loginResp.phone || loginResp.mobile || '',
    shortNo: loginResp.short_no || loginResp.shortNo || '',
    appId: loginResp.app_id || loginResp.appId || '',
    sex: loginResp.sex,
    raw: loginResp
  };
  return {
    token: loginResp.token || '',
    user,
    raw: loginResp
  };
}

function normalizeLoginUsername(username = '') {
  const value = String(username || '').trim();
  if (/^1\d{10}$/.test(value)) return `0086${value}`;
  return value;
}

function normalizePhone(value = '') {
  const raw = String(value || '').trim();
  return raw.replace(/^0086/, '').replace(/^\+?86/, '');
}

function normalizeZone(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '0086';
  return raw.startsWith('00') ? raw : `00${raw.replace(/^\+/, '')}`;
}

function extractWsAddrs(resp = {}) {
  return firstArray(resp.wsaddrs, resp.ws_addrs, resp.addrs, resp.data?.wsaddrs)
    .concat([resp.wss_addr, resp.ws_addr, resp.wssAddr, resp.wsAddr, resp.addr, resp.data?.wss_addr, resp.data?.ws_addr])
    .filter(Boolean);
}

function browserProtocol(options = {}) {
  return options.protocol || (typeof window !== 'undefined' ? window.location.protocol : '');
}

function hostnameFromUrl(value = '') {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

function isLocalNetworkHost(hostname = '') {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '0.0.0.0' || host === '127.0.0.1') return true;
  if (/^(10|192\.168)\./.test(host)) return true;
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31
    || parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

export function normalizeWsAddressForBrowser(addr = '', options = {}) {
  const raw = String(addr || '').trim();
  if (!raw) return '';
  const withScheme = /^wss?:\/\//i.test(raw) ? raw : `ws://${raw}`;
  try {
    const url = new URL(withScheme);
    const browserHostname = String(
      options.locationHostname
        || options.locationHost
        || (typeof window !== 'undefined' ? window.location.hostname : '')
        || ''
    ).split(':')[0];
    const wildcardHosts = new Set(['0.0.0.0', '127.0.0.1', 'localhost']);
    if (wildcardHosts.has(url.hostname) && browserHostname) {
      url.hostname = browserHostname;
    }
    const protocol = browserProtocol(options);
    if (protocol === 'https:' && url.protocol === 'ws:') {
      url.protocol = 'wss:';
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function selectWsAddressForBrowser(resp = {}, options = {}) {
  const addrs = extractWsAddrs(resp).map((addr) => normalizeWsAddressForBrowser(addr, options)).filter(Boolean);
  if (!addrs.length) return '';
  const protocol = browserProtocol(options);
  const preferred = protocol === 'https:'
    ? addrs.find((addr) => addr.startsWith('wss://'))
    : addrs.find((addr) => addr.startsWith('ws://'));
  const selected = preferred || addrs[0];
  if (protocol === 'http:' && selected.startsWith('wss://') && isLocalNetworkHost(hostnameFromUrl(selected))) {
    return selected.replace(/^wss:\/\//i, 'ws://');
  }
  return selected;
}

function messageChannelIdentity(message = {}) {
  const channel = message.channel || {};
  const channelId = channel.channelID || channel.channelId || channel.id || message.channel_id || message.channelId;
  const channelType = channel.channelType || channel.channel_type || message.channel_type || message.channelType || CHANNEL_TYPE_PERSON;
  return {
    channelId: String(channelId || message.from_uid || message.fromUID || ''),
    channelType: Number(channelType || CHANNEL_TYPE_PERSON)
  };
}

function contentToNativeText(content = '') {
  return JSON.stringify({ type: 1, content: String(content || '') });
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function firstList(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function toTimestampMs(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return value > 100000000000 ? value : value * 1000;
  }
  const text = String(value).trim();
  if (!text) return fallback;
  if (/^\d+$/.test(text)) return toTimestampMs(Number(text), fallback);
  const parsed = Date.parse(text.replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function padTimePart(value) {
  return String(value).padStart(2, '0');
}

function formatDeviceTime(value) {
  if (typeof value === 'string' && /刚刚|分钟前|小时前|天前|年|月|日/.test(value)) return value;
  const time = toTimestampMs(value, 0);
  if (!time) return firstNonEmpty(value, '未知');
  const date = new Date(time);
  return [
    date.getFullYear(),
    '-',
    padTimePart(date.getMonth() + 1),
    '-',
    padTimePart(date.getDate()),
    ' ',
    padTimePart(date.getHours()),
    ':',
    padTimePart(date.getMinutes())
  ].join('');
}

function normalizeDeviceType(device = {}) {
  const flag = Number(device.device_flag ?? device.deviceFlag ?? device.flag ?? 0);
  const source = `${device.device_name || device.deviceName || device.name || ''} ${device.device_model || device.deviceModel || device.model || ''}`.toLowerCase();
  if (flag === 1) return 'web';
  if (flag === 2) return 'desktop';
  if (/web|browser|chrome|edge|firefox|safari/.test(source)) return 'web';
  if (/pc|desktop|mac|windows|linux|book/.test(source)) return 'desktop';
  return 'mobile';
}

function normalizeDevice(device = {}, currentDeviceId = '') {
  const id = firstNonEmpty(device.device_id, device.deviceId, device.id);
  const name = firstNonEmpty(device.device_name, device.deviceName, device.name, device.device_model, '未命名设备');
  const isCurrent = Boolean(
    device.self === 1
    || device.isCurrent
    || device.current
    || (currentDeviceId && id === currentDeviceId)
    || /当前设备|本机/.test(name)
  );
  return {
    id,
    deviceId: id,
    name: name.replace(/（本机）|\(本机\)/g, '').trim() || '未命名设备',
    type: normalizeDeviceType(device),
    lastActive: formatDeviceTime(device.last_login ?? device.lastLogin ?? device.lastActive ?? device.updated_at ?? device.updatedAt),
    location: firstNonEmpty(device.login_addr, device.loginAddr, device.location, device.ip_city, device.ipCity, '未知'),
    isCurrent,
    raw: device
  };
}

function normalizeMention(value = '', fallback = '') {
  const raw = firstNonEmpty(value, fallback);
  if (!raw) return '';
  return raw.startsWith('@') ? raw : `@${raw}`;
}

function splitCapabilityTags(value = '') {
  return String(value || '')
    .split(/[、,，/|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function shouldPreferDirectClowderDirectory(options = {}) {
  return options?.preferDirect === true;
}

function clowderAgentSource(agent = {}) {
  return firstNonEmpty(
    agent.source,
    agent.sourceType,
    agent.source_type,
    agent.contact?.source,
    agent.contact?.sourceType,
    agent.raw?.source,
    agent.raw?.sourceType
  ).toLowerCase();
}

function isUserScopedClowderAgent(agent = {}) {
  const source = clowderAgentSource(agent).replace(/_/g, '-');
  if (firstNonEmpty(agent.creator, agent.createdBy, agent.created_by).toLowerCase() === 'user') {
    return true;
  }
  return [
    'runtime-created',
    'user-created',
    'user',
    'contact',
    'existing',
    'connected'
  ].includes(source);
}

function normalizeClowderAgent(agent = {}) {
  const id = firstNonEmpty(agent.catId, agent.cat_id, agent.roleTemplateId, agent.role_template_id, agent.id, agent.agentId, agent.uid);
  const name = firstNonEmpty(agent.displayName, agent.display_name, agent.name, agent.nickname, id, '智能体');
  const aliases = firstList(agent.aliases, agent.mentionPatterns, agent.mention_patterns);
  const alias = normalizeMention(aliases[0] || agent.alias, id || name);
  const capabilitySummary = firstNonEmpty(
    agent.capabilitySummary,
    agent.capability_summary,
    agent.teamStrengths,
    agent.team_strengths,
    agent.roleDescription,
    agent.role_description,
    agent.desc,
    agent.description
  );
  const personalitySummary = firstNonEmpty(agent.personalitySummary, agent.personality_summary, agent.personality, agent.systemPrompt);
  const capabilityTags = firstList(agent.capabilityTags, agent.capabilities)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const available = agent.available !== false && agent.availabilityState !== 'unavailable';

  return {
    id,
    uid: id,
    catId: id,
    directCatId: id,
    name,
    nickname: name,
    alias,
    desc: capabilitySummary || personalitySummary || '后端智能体已连接，可以开始协作',
    avatar: firstNonEmpty(agent.avatar, agent.logo),
    status: available ? 'active' : 'inactive',
    creator: isUserScopedClowderAgent(agent) ? 'User' : 'System',
    platform: firstNonEmpty(agent.platform, 'clowder'),
    accessMode: firstNonEmpty(agent.accessMode, 'backend'),
    model: firstNonEmpty(agent.model, agent.defaultModel),
    accountRef: firstNonEmpty(agent.accountRef),
    apiKey: '',
    apiUrl: '',
    customModel: '',
    systemPrompt: personalitySummary,
    roleTemplate: firstNonEmpty(agent.roleTemplate, 'general'),
    templateId: firstNonEmpty(agent.templateId, agent.roleTemplateId, 'general'),
    capabilityTags: capabilityTags.length ? capabilityTags : splitCapabilityTags(capabilitySummary),
    isAgent: true,
    connected: agent.connected !== false && available,
    source: 'clowder',
    preferred: Boolean(agent.preferred),
    raw: agent
  };
}

function isNotFoundError(error = {}) {
  const status = Number(error.status || error.statusCode || error.error?.status || error.error?.statusCode || 0);
  const message = String(error.msg || error.message || error.error?.data?.error || error.error?.data?.message || '');
  return status === 404 || /not found|不存在|未找到/i.test(message);
}

function normalizeCreatedClowderCat(resp = {}) {
  const agentSource = resp.agent || resp.data?.agent || resp.cat || resp.data?.cat || resp.data || resp;
  const normalized = normalizeClowderAgent({
    ...agentSource,
    source: agentSource.source || resp.contact?.source || resp.data?.contact?.source || 'runtime-created',
    connected: agentSource.connected ?? resp.contact?.connected ?? resp.data?.contact?.connected ?? true
  });
  return {
    ...normalized,
    catId: normalized.id,
    directCatId: normalized.id,
    creator: 'User',
    source: 'clowder',
    connected: normalized.connected !== false,
    apiKey: '',
    apiUrl: '',
    customModel: ''
  };
}

function normalizeGroupCatForSync(agent = {}) {
  const raw = agent.raw || {};
  const catId = firstNonEmpty(
    agent.catId,
    agent.cat_id,
    agent.directCatId,
    agent.direct_cat_id,
    agent.id,
    agent.agentId,
    agent.uid,
    raw.catId,
    raw.cat_id,
    raw.id
  ).replace(/^clowder_cat:/, '');
  const displayName = firstNonEmpty(agent.displayName, agent.name, agent.nickname, agent.alias, catId);
  const aliases = uniqueStrings([
    agent.alias,
    ...(Array.isArray(agent.aliases) ? agent.aliases : [])
  ]);
  return {
    catId,
    displayName,
    aliases,
    mentionPatterns: uniqueStrings([
      ...aliases,
      displayName,
      catId ? `@${catId}` : ''
    ]),
    avatar: firstNonEmpty(agent.avatar, agent.logo, raw.avatar),
    personalitySummary: firstNonEmpty(agent.personalitySummary, agent.personality, agent.systemPrompt, agent.desc, agent.description),
    capabilitySummary: firstList(agent.capabilities, agent.capabilityTags).join('、'),
    available: agent.available !== false,
    availabilityState: firstNonEmpty(agent.availabilityState, agent.status === 'inactive' ? 'unavailable' : 'available'),
    source: firstNonEmpty(agent.source, raw.source, 'ui'),
    connected: true
  };
}

function buildGroupCatsPrompt({ groupName = '', cats = [] } = {}) {
  const names = cats.map((cat) => cat.displayName || cat.catId).filter(Boolean).join('、');
  return [
    `群聊「${groupName || '未命名群聊'}」已连接智能体${names ? `：${names}` : ''}。`,
    '智能体只在被 @ 或明确点名时参与回复，并应遵守群聊上下文。'
  ].join('\n');
}

function normalizeFetchedGroupCat(cat = {}) {
  const raw = cat.raw || {};
  const id = firstNonEmpty(cat.catId, cat.cat_id, cat.id, cat.uid, raw.catId, raw.cat_id, raw.id).replace(/^clowder_cat:/, '');
  const name = firstNonEmpty(cat.displayName, cat.display_name, cat.name, cat.nickname, cat.alias, id);
  return {
    id,
    uid: id,
    catId: id,
    agentId: id,
    name,
    nickname: name,
    alias: firstNonEmpty(cat.alias, firstList(cat.aliases, cat.mentionPatterns, cat.mention_patterns)[0], id ? `@${id}` : ''),
    avatar: firstNonEmpty(cat.avatar, cat.logo, raw.avatar),
    desc: firstNonEmpty(cat.capabilitySummary, cat.capability_summary, cat.personalitySummary, cat.personality_summary, cat.description, cat.desc),
    isAgent: true,
    source: firstNonEmpty(cat.source, raw.source, 'clowder'),
    connected: cat.connected !== false,
    raw: cat
  };
}

function clientIdForAgentPlatform(platform = '') {
  const value = firstNonEmpty(platform).toLowerCase();
  if (value.includes('claude') || value.includes('anthropic')) return 'anthropic';
  return 'openai';
}

function authTypeForAccessMode(accessMode = '') {
  const value = firstNonEmpty(accessMode).toLowerCase();
  return value === 'oauth' ? 'oauth' : 'api_key';
}

function mergeClowderDirectoryAgents(agents = [], templates = []) {
  const seen = new Set();
  const result = [];
  [...agents, ...templates].forEach((item) => {
    const normalized = normalizeClowderAgent(item);
    const key = String(normalized.id || normalized.name || '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
}

function safeFileName(name = 'file') {
  return String(name || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 160) || 'file';
}

function extractUploadUrl(resp = {}) {
  return firstNonEmpty(resp.url, resp.upload_url, resp.uploadUrl, resp.data?.url, resp.data?.upload_url, resp.data?.uploadUrl);
}

function extractUploadedPath(resp = {}, fallback = '') {
  return firstNonEmpty(resp.path, resp.url, resp.data?.path, resp.data?.url, fallback);
}

function resolveFileName(file = {}) {
  return safeFileName(file.name || file.fileName || file.tempFilePath?.split('/').pop() || file.path?.split('/').pop() || 'file');
}

function defaultUploadRequest({ url, file, fieldName = 'file', headers = {} }) {
  if (!url) return Promise.reject(new Error('upload url is empty'));
  if (typeof FormData !== 'undefined' && typeof fetch === 'function' && (file.file || file.blob || file instanceof Blob)) {
    const form = new FormData();
    form.append(fieldName, file.file || file.blob || file, resolveFileName(file));
    return fetch(url, { method: 'POST', headers, body: form }).then(async (response) => {
      const text = await response.text();
      if (!response.ok) throw new Error(text || `upload failed (${response.status})`);
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        return { path: text };
      }
    });
  }
  if (typeof uni !== 'undefined' && typeof uni.uploadFile === 'function' && (file.path || file.tempFilePath || file.url)) {
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url,
        filePath: file.path || file.tempFilePath || file.url,
        name: fieldName,
        header: headers,
        success: (res) => {
          try {
            resolve(res.data ? JSON.parse(res.data) : {});
          } catch {
            resolve({ path: res.data });
          }
        },
        fail: reject
      });
    });
  }
  return Promise.reject(new Error('no supported upload runtime'));
}

export function createNativeImService(options = {}) {
  const nativeBaseUrl = options.baseUrl || resolveDefaultBaseUrl();
  const getToken = options.getToken || (() => readStorage('app_token'));
  const client = options.client || createNativeApiClient({
    baseUrl: nativeBaseUrl,
    getToken,
    request: options.request
  });
  const clowderClient = options.clowderClient || createNativeApiClient({
    baseUrl: options.clowderBaseUrl || resolveDefaultClowderBaseUrl(),
    getToken: () => '',
    request: options.request
  });
  const deviceFactory = options.deviceFactory || defaultDeviceFactory;
  const uploadRequest = options.uploadRequest || defaultUploadRequest;

  let sdkModule = null;
  let sdkShared = null;
  let listenersAttached = false;
  const runtimeCallbacks = {
    onMessage: null,
    onCmd: null,
    onStatus: null,
    onConversation: null,
    onMessageStatus: null
  };

  async function importSdk() {
    if (sdkModule) return sdkModule;
    try {
      const mod = options.sdkModule || await import('wukongimjssdk');
      const WKSDK = mod.WKSDK || mod.default || mod;
      sdkModule = {
        WKSDK,
        Channel: mod.Channel,
        MessageText: mod.MessageText,
        MessageImage: mod.MessageImage,
        MessageContentType: mod.MessageContentType,
        ChannelTypePerson: mod.ChannelTypePerson || CHANNEL_TYPE_PERSON,
        ChannelTypeGroup: mod.ChannelTypeGroup || CHANNEL_TYPE_GROUP
      };
      return sdkModule;
    } catch (error) {
      throw { msg: 'wukongimjssdk 未安装或不可用', error, sdkUnavailable: true };
    }
  }

  function getShared() {
    if (!sdkModule?.WKSDK?.shared) return null;
    sdkShared = sdkShared || sdkModule.WKSDK.shared();
    return sdkShared;
  }

  function setProviderCallbacks(shared) {
    if (!shared?.config) return;
    if (!shared.config.provider) shared.config.provider = {};
    shared.config.provider.connectAddrCallback = async (callback) => {
      const uid = shared.config.uid || readStorage('app_user_uid') || '';
      const resp = await client.get(`users/${encodeURIComponent(uid)}/im`);
      const addr = selectWsAddressForBrowser(resp);
      if (addr) callback(addr);
    };
    shared.config.provider.syncConversationsCallback = async () => {
      const conversations = await syncConversations();
      return conversations.map((item) => item.raw || item);
    };
    shared.config.provider.syncMessagesCallback = async (channel, opts = {}) => {
      const channelId = channel?.channelID || channel?.channelId || channel?.id;
      const channelType = channel?.channelType || channel?.channel_type || CHANNEL_TYPE_PERSON;
      return syncMessages(channelId, channelType, {
        limit: opts.limit || 15,
        startSeq: opts.startMessageSeq || opts.start_message_seq || 0,
        endSeq: opts.endMessageSeq || opts.end_message_seq || 0,
        pullMode: opts.pullMode
      });
    };
  }

  function attachListeners(shared) {
    if (listenersAttached || !shared) return;
    listenersAttached = true;
    shared.chatManager?.addMessageListener?.((message) => {
      runtimeCallbacks.onMessage?.({
        ...normalizeMessage(message),
        ...messageChannelIdentity(message),
        raw: message
      });
    });
    shared.chatManager?.addCMDListener?.((message) => {
      runtimeCallbacks.onCmd?.(message);
    });
    shared.connectManager?.addConnectStatusListener?.((status, reasonCode) => {
      runtimeCallbacks.onStatus?.({ status, reasonCode });
    });
    shared.chatManager?.addMessageStatusListener?.((packet) => {
      runtimeCallbacks.onMessageStatus?.({
        clientSeq: Number(packet.clientSeq || 0),
        messageId: String(packet.messageID || ''),
        messageSeq: Number(packet.messageSeq || 0),
        reasonCode: Number(packet.reasonCode || 0),
        raw: packet
      });
    });
    shared.conversationManager?.addConversationListener?.((conversation, action) => {
      runtimeCallbacks.onConversation?.({ conversation, action });
    });
  }

  async function initializeSdk(config = {}) {
    runtimeCallbacks.onMessage = config.onMessage || runtimeCallbacks.onMessage;
    runtimeCallbacks.onCmd = config.onCmd || runtimeCallbacks.onCmd;
    runtimeCallbacks.onStatus = config.onStatus || runtimeCallbacks.onStatus;
    runtimeCallbacks.onConversation = config.onConversation || runtimeCallbacks.onConversation;
    runtimeCallbacks.onMessageStatus = config.onMessageStatus || runtimeCallbacks.onMessageStatus;

    await importSdk();
    const shared = getShared();
    if (!shared) throw { msg: 'WKSDK.shared 不可用', sdkUnavailable: true };
    setProviderCallbacks(shared);
    attachListeners(shared);
    shared.config.uid = config.uid || shared.config.uid;
    shared.config.token = config.token || shared.config.token;
    shared.connect?.();
    return { connected: true, sdk: shared };
  }

  async function loginWithPassword({ username, password }) {
    const resp = await client.post('user/login', {
      username: normalizeLoginUsername(username),
      password,
      flag: 1,
      device: deviceFactory()
    });
    return normalizeSession(resp);
  }

  async function sendRegisterCode({ phone, zone = '0086' } = {}) {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) throw { msg: '请输入手机号' };
    return client.post('user/sms/registercode', {
      zone: normalizeZone(zone),
      phone: cleanPhone
    });
  }

  async function registerAccount({
    phone,
    code,
    name,
    nickname,
    password,
    zone = '0086'
  } = {}) {
    const cleanPhone = normalizePhone(phone);
    const displayName = firstNonEmpty(name, nickname);
    if (!cleanPhone) throw { msg: '请输入手机号' };
    if (!code) throw { msg: '请输入验证码' };
    if (!displayName) throw { msg: '请输入昵称' };
    if (!password) throw { msg: '请输入密码' };
    const resp = await client.post('user/register', {
      zone: normalizeZone(zone),
      phone: cleanPhone,
      name: displayName,
      code: String(code || '').trim(),
      password,
      flag: 1,
      device: deviceFactory()
    });
    return normalizeSession(resp);
  }

  async function updateCurrentUserProfile(fields = {}) {
    const payload = {};
    if (Object.prototype.hasOwnProperty.call(fields, 'name')) {
      payload.name = String(fields.name || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'nickname')) {
      payload.name = String(fields.nickname || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'sex')) {
      payload.sex = Number(fields.sex || 0);
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'shortNo')) {
      payload.short_no = String(fields.shortNo || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'short_no')) {
      payload.short_no = String(fields.short_no || '').trim();
    }
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '' || Number.isNaN(payload[key])) delete payload[key];
    });
    if (!Object.keys(payload).length) return normalizeSession({});
    const resp = await client.put('user/current', payload);
    return normalizeSession(resp);
  }

  async function syncConversations() {
    const resp = await client.post('conversation/sync', { msg_count: 1 });
    const channelInfoMap = buildChannelInfoMap(resp);
    return firstArray(resp.conversations, resp.data?.conversations).map((conversation) => {
      const id = conversation.channel_id || conversation.channelId || conversation.id;
      const type = conversation.channel_type || conversation.channelType || CHANNEL_TYPE_PERSON;
      return normalizeConversation(conversation, channelInfoMap.get(channelKey(id, type)) || {});
    });
  }

  async function syncMessages(channelId, channelType = CHANNEL_TYPE_PERSON, opts = {}) {
    const resp = await client.post('message/channel/sync', {
      limit: opts.limit || 30,
      channel_id: channelId,
      channel_type: channelType,
      start_message_seq: opts.startSeq || opts.startMessageSeq || 0,
      end_message_seq: opts.endSeq || opts.endMessageSeq || 0,
      pull_mode: opts.pullMode === undefined ? 1 : opts.pullMode
    });
    return firstArray(resp.messages, resp.data?.messages).map((message) => ({
      ...normalizeMessage(message),
      channelId: String(message.channel_id || message.channelId || channelId),
      channelType: Number(message.channel_type || message.channelType || channelType),
      raw: message
    }));
  }

  async function sendTextMessage({ channelId, channelType = CHANNEL_TYPE_PERSON, content = '', setting }) {
    await importSdk();
    const shared = getShared();
    if (!shared) throw { msg: 'WKSDK.shared 不可用', sdkUnavailable: true };
    const channel = sdkModule.Channel
      ? new sdkModule.Channel(channelId, channelType)
      : { channelID: channelId, channelId, channelType };
    let nativeContent = contentToNativeText(content);
    if (sdkModule.MessageText) {
      nativeContent = new sdkModule.MessageText(content);
    } else if (shared.getMessageContent && sdkModule.MessageContentType?.text) {
      nativeContent = shared.getMessageContent(sdkModule.MessageContentType.text);
      nativeContent.content = content;
    }
    const sent = await shared.chatManager?.send?.(nativeContent, channel, setting);
    return {
      ...normalizeMessage(sent || { payload: { type: 1, content } }),
      channelId: String(channelId),
      channelType: Number(channelType)
    };
  }

  async function sendClowderConversationMessage({
    channelId,
    channelType = CHANNEL_TYPE_PERSON,
    text = '',
    directCatId = '',
    targetCatIds,
    promptContext = ''
  } = {}) {
    if (!channelId) throw { msg: 'channelId不能为空' };
    const trimmedText = String(text || '').trim();
    if (!trimmedText) throw { msg: '消息内容不能为空' };
    const payload = {
      channelId: String(channelId),
      channelType: Number(channelType),
      text: trimmedText
    };
    if (directCatId) payload.directCatId = String(directCatId);
    if (Array.isArray(targetCatIds) && targetCatIds.length) {
      payload.targetCatIds = targetCatIds.map(String).filter(Boolean);
    }
    if (promptContext) payload.promptContext = String(promptContext);

    const resp = await client.post('clowder/conversation/message', payload);
    const source = resp.message || resp.data?.message || resp.data || resp;
    return {
      ...normalizeMessage({
        ...source,
        message_id: source.message_id || source.messageId || source.id || resp.message_id || resp.messageId || resp.id,
        payload: source.payload || { type: 1, content: trimmedText },
        status: source.status || resp.status || 'success'
      }),
      channelId: String(channelId),
      channelType: Number(channelType),
      content: trimmedText
    };
  }

  async function createClowderCat(agent = {}) {
    const clientId = clientIdForAgentPlatform(agent.platform || agent.clientId);
    const authType = authTypeForAccessMode(agent.accessMode || agent.authType);
    const payload = {
      name: firstNonEmpty(agent.name, agent.nickname),
      alias: firstNonEmpty(agent.alias),
      roleTemplateId: firstNonEmpty(agent.roleTemplateId, agent.roleTemplate, agent.templateId, 'general'),
      clientId,
      authType,
      accountRef: authType === 'oauth'
        ? defaultOAuthAccountRef(clientId)
        : firstNonEmpty(agent.accountRef, agent.account_ref, 'default'),
      personality: firstNonEmpty(agent.personality, agent.systemPrompt, agent.desc),
      capabilities: firstList(agent.capabilities, agent.capabilityTags).map(String).filter(Boolean)
    };
    if (authType !== 'oauth') {
      payload.defaultModel = firstNonEmpty(agent.defaultModel, agent.model, agent.customModel);
    }
    if (!payload.name) throw { msg: '请输入智能体名称' };
    const resp = await client.post('clowder/cats', payload);
    return normalizeCreatedClowderCat(resp);
  }

  async function getLocalAuthCapabilities() {
    const resp = await client.get('clowder/local-auth/capabilities');
    return normalizeLocalOAuthCapabilities(resp);
  }

  async function syncGroupCats({ groupId, groupName = '', agents = [], catIds = [], cats = [], prompt = '', proactiveReplies = false, autoReplyMode = 'mentions_only' } = {}) {
    const id = String(groupId || '').trim();
    if (!id) throw { msg: 'groupId不能为空' };
    const normalizedCats = (cats.length > 0 ? cats : agents).map((cat) => normalizeGroupCatForSync(cat));
    const payload = {
      groupId: id,
      groupName: String(groupName || id).trim(),
      catIds: uniqueStrings([
        ...catIds,
        ...normalizedCats.map((cat) => cat.catId)
      ]),
      cats: normalizedCats,
      prompt: prompt || buildGroupCatsPrompt({ groupName: groupName || id, cats: normalizedCats }),
      proactiveReplies: proactiveReplies === true,
      autoReplyMode
    };
    return client.post('clowder/group/cats/sync', payload);
  }

  async function fetchGroupCats({ groupId } = {}) {
    const id = String(groupId || '').trim();
    if (!id) throw { msg: 'groupId不能为空' };
    const resp = await client.get('clowder/group/cats', { groupId: id });
    return firstArray(resp.cats, resp.data?.cats, resp.agents, resp.data?.agents).map(normalizeFetchedGroupCat);
  }

  async function ensureProjectGroup(payload = {}) {
    const data = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        data[key] = uniqueStrings(value);
        return;
      }
      data[key] = value;
    });
    if (!data.projectName) throw { msg: 'projectName不能为空' };
    if (!data.pmDirectChannelId) throw { msg: 'pmDirectChannelId不能为空' };
    const resp = await client.post('clowder/project-groups/ensure', data);
    return {
      ...resp,
      binding: resp.binding || resp.data?.binding || resp.data || resp,
      reused: Boolean(resp.reused ?? resp.data?.reused ?? resp.binding?.reused ?? false),
      raw: resp
    };
  }

  async function updateProjectGroupThread(bindingId, payload = {}) {
    const id = String(bindingId || '').trim();
    if (!id) throw { msg: 'bindingId不能为空' };
    const data = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      data[key] = value;
    });
    const resp = await client.post(`clowder/project-groups/${encodeURIComponent(id)}/thread`, data);
    return {
      ...resp,
      binding: resp.binding || resp.data?.binding || resp.data || resp,
      raw: resp
    };
  }

  async function updateConversationSettings({ channelId, channelType = CHANNEL_TYPE_PERSON, isPinned, isMuted } = {}) {
    if (!channelId) throw { msg: 'channelId不能为空' };
    const payload = {};
    if (isPinned !== undefined) payload.top = isPinned ? 1 : 0;
    if (isMuted !== undefined) payload.mute = isMuted ? 1 : 0;
    if (!Object.keys(payload).length) return {};

    const encodedChannelId = encodeURIComponent(String(channelId));
    const path = Number(channelType) === CHANNEL_TYPE_GROUP
      ? `groups/${encodedChannelId}/setting`
      : `users/${encodedChannelId}/setting`;
    try {
      return await client.put(path, payload);
    } catch (error) {
      if (/发送频道更新命令失败/.test(String(error?.msg || error?.message || ''))) {
        return {
          settingPersisted: true,
          commandNotifyFailed: true,
          error
        };
      }
      throw error;
    }
  }

  async function updateConversationExtra({ channelId, channelType = CHANNEL_TYPE_PERSON, draft, browseTo, keepMessageSeq, keepOffsetY } = {}) {
    if (!channelId) throw { msg: 'channelId不能为空' };
    const payload = {
      channel_id: String(channelId),
      channel_type: Number(channelType)
    };
    if (draft !== undefined) payload.draft = String(draft || '');
    if (browseTo !== undefined) payload.browse_to = browseTo;
    if (keepMessageSeq !== undefined) payload.keep_message_seq = keepMessageSeq;
    if (keepOffsetY !== undefined) payload.keep_offset_y = keepOffsetY;
    return client.post(`conversations/${encodeURIComponent(String(channelId))}/${Number(channelType)}/extra`, payload);
  }

  async function clearConversationUnread({ channelId, channelType = CHANNEL_TYPE_PERSON, unread = 0, messageSeq = 0 } = {}) {
    if (!channelId) throw { msg: 'channelId不能为空' };
    return client.put('coversation/clearUnread', {
      channel_id: String(channelId),
      channel_type: Number(channelType),
      unread: Number(unread || 0),
      message_seq: Number(messageSeq || 0)
    });
  }

  async function deleteConversation({ channelId, channelType = CHANNEL_TYPE_PERSON } = {}) {
    if (!channelId) throw { msg: 'channelId不能为空' };
    return client.delete(`conversations/${encodeURIComponent(String(channelId))}/${Number(channelType)}`);
  }

  async function uploadChatFile({ channelId, channelType = CHANNEL_TYPE_PERSON, file, type = 'chat' } = {}) {
    if (!channelId) throw { msg: 'channelId不能为空' };
    if (!file) throw { msg: '请选择文件' };
    const name = resolveFileName(file);
    const uploadPath = `chat/${String(channelId)}/${Number(channelType)}/${name}`;
    const uploadMeta = await client.get('file/upload', { path: uploadPath, type });
    const uploadUrl = extractUploadUrl(uploadMeta);
    if (!uploadUrl) throw { msg: '未获取到上传地址' };
    const uploaded = await uploadRequest({ url: uploadUrl, file: { ...file, name }, fieldName: 'file' });
    const url = extractUploadedPath(uploaded, extractUploadedPath(uploadMeta));
    if (!url) throw { msg: '文件上传失败' };
    return {
      url,
      name,
      fileName: name,
      size: file.size || file.fileSize || 0,
      mimeType: file.type || file.mimeType || '',
      raw: uploaded
    };
  }

  async function sendMediaMessage({ channelId, channelType = CHANNEL_TYPE_PERSON, mediaType, url, fileName, fileSize = 0 } = {}) {
    if (!channelId) throw { msg: 'channelId不能为空' };
    if (!url) throw { msg: '媒体地址不能为空' };
    await importSdk();
    const shared = getShared();
    if (!shared) throw { msg: 'WKSDK.shared 不可用', sdkUnavailable: true };
    const channel = sdkModule.Channel
      ? new sdkModule.Channel(channelId, channelType)
      : { channelID: channelId, channelId, channelType };
    let content = null;
    if (mediaType === 'image' && sdkModule.MessageImage) {
      content = new sdkModule.MessageImage(undefined, 0, 0);
      content.url = url;
    } else if (shared.getMessageContent) {
      const contentType = mediaType === 'image' ? 2 : 8;
      content = shared.getMessageContent(contentType);
      content.url = url;
      content.name = fileName;
      content.size = fileSize;
      content.content = mediaType === 'image' ? '[图片]' : `[文件] ${fileName || ''}`.trim();
    } else {
      content = {
        contentType: mediaType === 'image' ? 2 : 8,
        type: mediaType === 'image' ? 2 : 8,
        url,
        name: fileName,
        size: fileSize,
        content: mediaType === 'image' ? '[图片]' : `[文件] ${fileName || ''}`.trim()
      };
    }
    const sent = await shared.chatManager?.send?.(content, channel);
    return {
      ...normalizeMessage(sent || { payload: { type: mediaType === 'image' ? 2 : 8, url, name: fileName, size: fileSize } }),
      channelId: String(channelId),
      channelType: Number(channelType),
      url,
      fileName,
      fileSize
    };
  }

  async function syncFriends(params = {}) {
    const resp = await client.get('friend/sync', {
      version: params.version || 0,
      limit: params.limit || 1000,
      keyword: params.keyword || undefined,
      api_version: params.apiVersion || params.api_version || 1
    });
    return firstArray(resp, resp.friends, resp.data, resp.list, resp.users).map(normalizeFriend);
  }

  async function searchUser(keyword, context = {}) {
    const resp = await client.get('user/search', { keyword });
    return normalizeFriendSearchResult(resp, context);
  }

  async function applyFriend({ toUid, uid, remark, vercode }) {
    return client.post('friend/apply', {
      to_uid: toUid || uid,
      remark: remark || '',
      vercode: vercode || ''
    });
  }

  async function fetchFriendRequests(params = {}) {
    const resp = await client.get('friend/apply', {
      page_index: params.pageIndex || params.page_index || 1,
      page_size: params.pageSize || params.page_size || 30
    });
    return firstArray(resp, resp.applies, resp.list, resp.data, resp.items).map(normalizeFriendRequest);
  }

  async function approveFriendRequest(request) {
    const token = typeof request === 'string' ? request : request?.token;
    if (token) {
      return client.post('friend/sure', { token });
    }
    const toUid = request?.to_uid || request?.uid || request?.id;
    return client.delete(`friend/apply/${encodeURIComponent(toUid)}`);
  }

  async function createGroup({ name, members = [] } = {}) {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) throw { msg: '请输入群聊名称' };
    const resp = await client.post('group/create', {
      name: trimmedName,
      members: members.map(String)
    });
    return normalizeNativeGroup(resp.data || resp.group || resp);
  }

  async function syncMyGroups() {
    const resp = await client.get('group/my');
    return firstArray(resp, resp.groups, resp.list, resp.data, resp.data?.groups).map(normalizeNativeGroup);
  }

  async function syncGroupMembers(groupNo, params = {}) {
    if (!groupNo) return [];
    const resp = await client.get(`groups/${encodeURIComponent(String(groupNo))}/membersync`, {
      version: params.version || 0,
      limit: params.limit || 1000
    });
    return firstArray(resp, resp.members, resp.list, resp.data, resp.data?.members).map(normalizeNativeGroupMember);
  }

  async function updateGroupProfile(groupNo, fields = {}) {
    if (!groupNo) throw { msg: 'groupNo不能为空' };
    const payload = {};
    if (Object.prototype.hasOwnProperty.call(fields, 'name')) payload.name = String(fields.name || '');
    if (Object.prototype.hasOwnProperty.call(fields, 'notice')) payload.notice = String(fields.notice || '');
    if (!Object.keys(payload).length) return {};
    return client.put(`groups/${encodeURIComponent(String(groupNo))}`, payload);
  }

  async function fetchDevices() {
    const currentDevice = deviceFactory() || {};
    const currentDeviceId = firstNonEmpty(currentDevice.device_id, currentDevice.deviceId, currentDevice.id);
    const resp = await client.get('user/devices');
    return firstArray(resp, resp.devices, resp.data, resp.data?.devices, resp.list, resp.items)
      .map((device) => normalizeDevice(device, currentDeviceId))
      .filter((device) => device.id);
  }

  async function deleteDevice(deviceId) {
    const id = String(deviceId || '').trim();
    if (!id) throw { msg: 'deviceId不能为空' };
    return client.delete(`user/devices/${encodeURIComponent(id)}`);
  }

  async function deleteClowderCat(catId) {
    const id = String(catId || '').trim();
    if (!id) throw { msg: 'catId不能为空' };
    try {
      return await client.delete(`clowder/cats/${encodeURIComponent(id)}`);
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          deleted: true,
          id,
          alreadyDeleted: true,
          status: Number(error.status || error.statusCode || 404)
        };
      }
      throw error;
    }
  }

  async function fetchClowderCatDirectory(params = {}) {
    let resp = null;
    if (shouldPreferDirectClowderDirectory(params)) {
      resp = await fetchDirectClowderCatDirectory(params);
    } else try {
      resp = await client.get('clowder/cats', {
        query: params.query || undefined,
        includeUnavailable: params.includeUnavailable === undefined ? true : params.includeUnavailable
      });
    } catch (error) {
      resp = await fetchDirectClowderCatDirectory(params, error);
    }
    const rawAgents = firstArray(resp.agents, resp.data?.agents, resp.cats, resp.data?.cats);
    const rawTemplates = firstArray(resp.templates, resp.data?.templates);
    return {
      ...resp,
      agents: mergeClowderDirectoryAgents(rawAgents, rawTemplates),
      templates: rawTemplates
    };
  }

  async function fetchClowderCatTemplates() {
    try {
      const resp = await clowderClient.get('cat-templates');
      return firstArray(resp.templates, resp.data?.templates);
    } catch {
      return [];
    }
  }

  async function fetchDirectClowderCatDirectory(params = {}, nativeError) {
    const [templatesResp, agentsResp] = await Promise.all([
      clowderClient.get('cat-templates').catch(() => ({})),
      clowderClient.get('connectors/im-web/agents', {
        externalChatId: params.externalChatId || '1:clowder_ai'
      }).catch(() => ({}))
    ]);
    const templates = firstArray(templatesResp.templates, templatesResp.data?.templates);
    const agents = firstArray(agentsResp.agents, agentsResp.data?.agents);
    if (!templates.length && !agents.length) throw nativeError;
    return {
      agents,
      templates,
      clientDefaults: templatesResp.clientDefaults || templatesResp.data?.clientDefaults,
      skillCatalog: templatesResp.skillCatalog || templatesResp.data?.skillCatalog,
      directClowderFallback: true,
      nativeError
    };
  }

  async function fetchClowderConversationAgents({ channelId, channelType = CHANNEL_TYPE_PERSON } = {}) {
    if (!channelId) throw { msg: 'channelId不能为空' };
    const resp = await client.get('clowder/conversation/agents', {
      channelId: String(channelId),
      channelType: Number(channelType)
    });
    const rawAgents = firstArray(resp.agents, resp.data?.agents);
    return {
      ...resp,
      agents: rawAgents.map(normalizeClowderAgent)
    };
  }

  async function fetchSkillSummary() {
    const resp = await client.get('clowder/skills/summary');
    return normalizeUserSkillList(firstArray(resp.skills, resp.data?.skills, resp.items, resp.data));
  }

  async function fetchUserSkills() {
    const resp = await client.get('clowder/skills');
    return normalizeUserSkillList(firstArray(resp.skills, resp.data?.skills, resp.items, resp.data));
  }

  async function fetchSkillMarketplace() {
    const resp = await client.get('clowder/skills/marketplace');
    return normalizeMarketplaceSkillList(firstArray(resp.skills, resp.data?.skills, resp.items, resp.data));
  }

  async function addMarketplaceSkill(sourceId) {
    const id = String(sourceId || '').trim();
    if (!id) throw { msg: 'sourceId不能为空' };
    const resp = await client.post(`clowder/skills/${encodeURIComponent(id)}/add`, { sourceId: id });
    return normalizeUserSkill(resp.skill || resp.data?.skill || resp.data || resp);
  }

  async function updateUserSkill(userSkillId, patch = {}) {
    const id = String(userSkillId || '').trim();
    if (!id) throw { msg: 'userSkillId不能为空' };
    const resp = await client.patch(`clowder/skills/${encodeURIComponent(id)}`, patch);
    return normalizeUserSkill(resp.skill || resp.data?.skill || resp.data || resp);
  }

  async function deleteUserSkill(userSkillId) {
    const id = String(userSkillId || '').trim();
    if (!id) throw { msg: 'userSkillId不能为空' };
    return client.delete(`clowder/skills/${encodeURIComponent(id)}`);
  }

  async function updateSkillAssignments(userSkillId, agentIds = []) {
    const id = String(userSkillId || '').trim();
    if (!id) throw { msg: 'userSkillId不能为空' };
    const resp = await client.put(`clowder/skills/${encodeURIComponent(id)}/assignments`, {
      agentIds: Array.isArray(agentIds) ? agentIds.map(String).filter(Boolean) : []
    });
    return normalizeUserSkill(resp.skill || resp.data?.skill || resp.data || resp);
  }

  async function uploadSkillPackage(payload = {}) {
    const file = payload.file || payload.blob || payload;
    const name = payload.name || file.name || payload.fileName || resolveFileName(file) || 'skill.zip';
    const headers = {};
    const token = getToken();
    if (token) headers.token = token;
    const uploadUrl = joinServiceUrl(nativeBaseUrl, 'clowder/skills/upload');
    const hasBlobUpload = typeof Blob !== 'undefined' && (
      file instanceof Blob ||
      payload.blob instanceof Blob ||
      payload.file instanceof Blob ||
      file?.blob instanceof Blob ||
      file?.file instanceof Blob
    );
    if (typeof FormData !== 'undefined' && typeof fetch === 'function' && hasBlobUpload) {
      const form = new FormData();
      const uploadFile = payload.blob || (payload.file instanceof Blob ? payload.file : null) || (file instanceof Blob ? file : null) || file.blob || file.file;
      form.append('file', uploadFile, name);
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: form
      });
      const text = await response.text();
      let resp = {};
      try {
        resp = text ? JSON.parse(text) : {};
      } catch {
        resp = { msg: text };
      }
      if (!response.ok) throw { msg: resp.msg || resp.error || `上传失败 (${response.status})`, status: response.status };
      return normalizeUserSkill(resp.skill || resp.data?.skill || resp.data || resp);
    }
    if (typeof file === 'string' || file?.path || file?.tempFilePath || file?.url || file?.blob) {
      const uploaded = await uploadRequest({
        url: uploadUrl,
        file: typeof file === 'string' ? { name, path: file } : { ...file, name },
        fieldName: 'file',
        headers
      });
      return normalizeUserSkill(uploaded.skill || uploaded.data?.skill || uploaded.data || uploaded);
    }
    const resp = await client.post('clowder/skills/upload', payload);
    return normalizeUserSkill(resp.skill || resp.data?.skill || resp.data || resp);
  }

  async function fetchActiveProjectGroup(params = {}) {
    const query = {};
    if (params.projectGroupNo || params.groupId) query.projectGroupNo = String(params.projectGroupNo || params.groupId);
    if (params.projectGroupId) query.projectGroupId = String(params.projectGroupId);
    if (params.pmDirectChannelId || params.channelId) query.pmDirectChannelId = String(params.pmDirectChannelId || params.channelId);
    if (params.pmDirectChannelType || params.channelType) query.pmDirectChannelType = Number(params.pmDirectChannelType || params.channelType);
    if (params.projectName) query.projectName = String(params.projectName);
    const resp = await client.get('clowder/project-groups/active', query);
    return resp.binding || resp.data?.binding || resp.data || resp;
  }

  async function fetchThreadTasks(threadId, params = {}) {
    const id = String(threadId || '').trim();
    if (!id) return [];
    const resp = await client.get(`clowder/thread/${encodeURIComponent(id)}/tasks`, params);
    return firstArray(resp.tasks, resp.data?.tasks, resp.items, resp.data?.items, resp.data);
  }

  async function createCoordination(payload = {}) {
    return client.post('clowder/coordinator/coordination', payload);
  }

  async function createDeploymentRequest(payload = {}) {
    const resp = await client.post('clowder/conversation/deployment-request', payload);
    return normalizeDeploymentRequest(resp.deploymentRequest || resp.data?.deploymentRequest || resp.data || resp);
  }

  async function updateDeploymentRequest(deploymentRequestId, patch = {}) {
    const id = String(deploymentRequestId || '').trim();
    if (!id) throw { msg: 'deploymentRequestId不能为空' };
    const resp = await client.patch(`clowder/conversation/deployment-request/${encodeURIComponent(id)}`, patch);
    return normalizeDeploymentRequest(resp.deploymentRequest || resp.data?.deploymentRequest || resp.data || resp);
  }

  async function fetchActiveDeploymentRequest(params = {}) {
    const query = {};
    if (params.channelId) query.channelId = String(params.channelId);
    if (params.channelType) query.channelType = Number(params.channelType);
    const resp = await client.get('clowder/conversation/deployment-request/active', query);
    const source = resp.deploymentRequest || resp.data?.deploymentRequest || resp.data || resp;
    return source ? normalizeDeploymentRequest(source) : null;
  }

  async function fetchDeploymentRequest(deploymentRequestId) {
    const id = String(deploymentRequestId || '').trim();
    if (!id) throw { msg: 'deploymentRequestId不能为空' };
    const resp = await client.get(`clowder/conversation/deployment-request/${encodeURIComponent(id)}`);
    return normalizeDeploymentRequest(resp.deploymentRequest || resp.data?.deploymentRequest || resp.data || resp);
  }

  async function sendDeploymentAction(payload = {}) {
    const resp = await client.post('clowder/conversation/deployment-action', payload);
    return {
      ...resp,
      deploymentRequest: resp.deploymentRequest || resp.data?.deploymentRequest
        ? normalizeDeploymentRequest(resp.deploymentRequest || resp.data?.deploymentRequest)
        : null
    };
  }

  async function fetchDeployment(deploymentId) {
    const id = String(deploymentId || '').trim();
    if (!id) throw { msg: 'deploymentId不能为空' };
    const resp = await client.get(`clowder/deployments/${encodeURIComponent(id)}`);
    return resp.deployment || resp.data?.deployment || resp.data || resp;
  }

  async function fetchDeploymentLogs(deploymentId) {
    const id = String(deploymentId || '').trim();
    if (!id) throw { msg: 'deploymentId不能为空' };
    const resp = await client.get(`clowder/deployments/${encodeURIComponent(id)}/logs`);
    return firstArray(resp.logs, resp.data?.logs, resp.items, resp.data?.items, resp.data);
  }

  function disconnect() {
    try {
      getShared()?.disconnect?.();
    } catch {
      // ignore disconnect failures during logout
    }
  }

  return {
    CHANNEL_TYPE_PERSON,
    CHANNEL_TYPE_GROUP,
    client,
    loginWithPassword,
    sendRegisterCode,
    registerAccount,
    updateCurrentUserProfile,
    initializeSdk,
    syncConversations,
    syncMessages,
    sendTextMessage,
    sendClowderConversationMessage,
    createClowderCat,
    getLocalAuthCapabilities,
    syncGroupCats,
    fetchGroupCats,
    ensureProjectGroup,
    updateProjectGroupThread,
    sendMediaMessage,
    uploadChatFile,
    updateConversationSettings,
    updateConversationExtra,
    clearConversationUnread,
    deleteConversation,
    syncFriends,
    searchUser,
    applyFriend,
    fetchFriendRequests,
    approveFriendRequest,
    createGroup,
    syncMyGroups,
    syncGroupMembers,
    updateGroupProfile,
    fetchDevices,
    deleteDevice,
    deleteClowderCat,
    fetchClowderCatDirectory,
    fetchClowderCatTemplates,
    fetchClowderConversationAgents,
    fetchSkillSummary,
    fetchUserSkills,
    fetchSkillMarketplace,
    addMarketplaceSkill,
    updateUserSkill,
    deleteUserSkill,
    updateSkillAssignments,
    uploadSkillPackage,
    fetchActiveProjectGroup,
    fetchThreadTasks,
    createCoordination,
    createDeploymentRequest,
    updateDeploymentRequest,
    fetchActiveDeploymentRequest,
    fetchDeploymentRequest,
    sendDeploymentAction,
    fetchDeployment,
    fetchDeploymentLogs,
    disconnect,
    get sdkReady() {
      return Boolean(sdkShared);
    },
    get sdk() {
      return sdkShared;
    },
    getChannelIdentity: messageChannelIdentity,
    normalizeLoginUsername,
    toNativeText: contentToNativeText
  };
}

export const nativeImService = createNativeImService();
