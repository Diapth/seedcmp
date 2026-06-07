import { createNativeApiClient } from './api-client.js';
import {
  normalizeConversation,
  normalizeFriend,
  normalizeFriendRequest,
  normalizeFriendSearchResult,
  normalizeMessage
} from './normalizers.js';

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

function resolveDefaultBaseUrl() {
  const env = import.meta.env || {};
  return readStorage('native_api_base_url')
    || env.VITE_TANGSENG_API_BASE_URL
    || env.VITE_API_BASE_URL
    || '/v1/';
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

function extractWsAddrs(resp = {}) {
  return firstArray(resp.wsaddrs, resp.ws_addrs, resp.addrs, resp.data?.wsaddrs)
    .concat([resp.wss_addr, resp.ws_addr, resp.wssAddr, resp.wsAddr, resp.addr, resp.data?.wss_addr, resp.data?.ws_addr])
    .filter(Boolean);
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
    const protocol = options.protocol || (typeof window !== 'undefined' ? window.location.protocol : '');
    if (protocol === 'https:' && url.protocol === 'ws:') {
      url.protocol = 'wss:';
    }
    return url.toString();
  } catch {
    return raw;
  }
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

export function createNativeImService(options = {}) {
  const client = options.client || createNativeApiClient({
    baseUrl: options.baseUrl || resolveDefaultBaseUrl(),
    getToken: options.getToken || (() => readStorage('app_token')),
    request: options.request
  });
  const deviceFactory = options.deviceFactory || defaultDeviceFactory;

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
      const addrs = extractWsAddrs(resp);
      if (addrs[0]) callback(normalizeWsAddressForBrowser(addrs[0]));
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
    initializeSdk,
    syncConversations,
    syncMessages,
    sendTextMessage,
    updateConversationSettings,
    syncFriends,
    searchUser,
    applyFriend,
    fetchFriendRequests,
    approveFriendRequest,
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
