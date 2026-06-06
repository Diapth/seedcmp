import { AppError } from './request.js';
import { registerCMDListeners, registerMessageListeners } from './listeners.js';
import { useImStore } from '@/stores/im.js';

const REGISTERED = Symbol.for('agenthub.wksdk.registered');
let sdkModulePromise = null;
let initialized = {
  uid: '',
  token: '',
  wsAddr: ''
};

async function loadSdkModule() {
  if (!sdkModulePromise) {
    sdkModulePromise = import('wukongimjssdk');
  }
  return sdkModulePromise;
}

export async function getWKSdk() {
  const mod = await loadSdkModule();
  const sdk = mod.default || mod.WKSDK || mod;
  if (!sdk?.shared) {
    throw new AppError('WKSDK shared() 不可用', { code: 'SDK_UNAVAILABLE' });
  }
  return sdk;
}

function resolveWsAddr(wsAddr) {
  if (wsAddr) return wsAddr;
  return useImStore().wsAddr || '';
}

export async function initSdk({ uid, token, wsAddr }) {
  if (!uid || !token) {
    throw new AppError('缺少 IM uid/token，无法初始化 SDK', { code: 'SDK_AUTH_MISSING' });
  }
  const sdk = await getWKSdk();
  const shared = sdk.shared();
  const nextWsAddr = resolveWsAddr(wsAddr);
  if (initialized.uid === uid && initialized.token === token && initialized.wsAddr === nextWsAddr) {
    return shared;
  }

  initialized = { uid, token, wsAddr: nextWsAddr };
  shared.config.uid = uid;
  shared.config.token = token;
  if (shared.config.provider) {
    shared.config.provider.connectAddrCallback = (callback) => callback(nextWsAddr);
  }

  if (shared[REGISTERED]) {
    try {
      shared.disconnect?.();
    } catch {
      // Re-registering after HMR should not break initialization.
    }
  }
  registerCMDListeners(shared);
  registerMessageListeners(shared);
  shared[REGISTERED] = true;
  shared.connect?.();
  return shared;
}

export async function disconnectSdk() {
  if (!sdkModulePromise) return;
  const sdk = await getWKSdk();
  try {
    sdk.shared().disconnect?.();
  } finally {
    initialized = { uid: '', token: '', wsAddr: '' };
  }
}

export async function sendTextMessage({ channelId, channelType, text, clientMsgNo }) {
  const sdk = await getWKSdk();
  const shared = sdk.shared();
  const chatManager = shared?.chatManager;
  if (!chatManager?.send) {
    throw new AppError('WKSDK 当前不可发送消息', { code: 'SDK_UNAVAILABLE' });
  }
  const Channel = sdk.Channel || shared.Channel;
  const TextContent = sdk.MessageText || sdk.TextContent || null;
  const channel = shared.newChannel
    ? shared.newChannel(channelId, channelType)
    : Channel
      ? new Channel(channelId, channelType)
      : { channelID: channelId, channelType };
  const content = shared.newMessageText
    ? shared.newMessageText(text)
    : TextContent
      ? new TextContent(text)
      : { text, content: text, type: 'text', encode: () => new Uint8Array() };
  const sent = await chatManager.send(content, channel);
  if (sent && clientMsgNo) {
    sent.clientMsgNo = clientMsgNo;
  }
  return sent;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disconnectSdk();
  });
}
