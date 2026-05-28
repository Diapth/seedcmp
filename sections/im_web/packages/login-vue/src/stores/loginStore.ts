import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { authApi } from '@tsdaodao/datasource-vue';

const DEVICE_ID_MAX_LENGTH = 40;
const DEVICE_TEXT_MAX_LENGTH = 100;

function limitDeviceField(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function getBrowserModel() {
  const userAgent = navigator.userAgent || '';
  const browserMatch = userAgent.match(/(Edg|Chrome|Firefox|Version)\/([\d.]+)/i);
  if (!browserMatch) {
    return 'Web Browser';
  }
  const browserName = browserMatch[1] === 'Version' ? 'Safari' : browserMatch[1].replace('Edg', 'Edge');
  return `${browserName} ${browserMatch[2].split('.')[0]}`;
}

function getDeviceId() {
  const storageKey = 'tsdd-web-device-id';
  const existing = localStorage.getItem(storageKey);
  if (existing) {
    return limitDeviceField(existing, DEVICE_ID_MAX_LENGTH);
  }

  const deviceId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const safeDeviceId = limitDeviceField(deviceId, DEVICE_ID_MAX_LENGTH);
  localStorage.setItem(storageKey, safeDeviceId);
  return safeDeviceId;
}

export function buildLoginDevice() {
  return {
    device_id: getDeviceId(),
    device_name: limitDeviceField('Web Browser', DEVICE_TEXT_MAX_LENGTH),
    device_model: limitDeviceField(getBrowserModel(), DEVICE_TEXT_MAX_LENGTH)
  };
}

export type LoginState =
  | 'idle'
  | 'loading'
  | 'sms_sent'
  | 'qr_waiting'
  | 'qr_scanned'
  | 'qr_confirmed'
  | 'qr_expired'
  | 'qr_rejected'
  | 'qr_failed'
  | 'logged_in';

export function normalizeQrLoginStatus(payload: any): LoginState {
  const raw = String(payload?.status ?? payload?.state ?? payload?.code ?? '').toLowerCase();
  if (['waiting', 'wait', '0', 'qr_waiting'].includes(raw)) return 'qr_waiting';
  if (['scanned', 'scan', '1', 'qr_scanned'].includes(raw)) return 'qr_scanned';
  if (['confirmed', 'confirm', 'authorized', 'success', '2', 'qr_confirmed'].includes(raw) || payload?.auth_code || payload?.authCode) {
    return 'qr_confirmed';
  }
  if (['expired', 'timeout', '3', 'qr_expired'].includes(raw)) return 'qr_expired';
  if (['rejected', 'cancel', 'cancelled', '4', 'qr_rejected'].includes(raw)) return 'qr_rejected';
  return 'qr_failed';
}

export const useLoginStore = defineStore('loginState', () => {
  const state = ref<LoginState>('idle');
  const qrUuid = ref('');
  const qrAuthCode = ref('');
  const qrError = ref('');
  const userStore = useUserStore();

  function normalizeUsername(value: string) {
    const raw = value.trim();
    if (/^0086\d{11}$/.test(raw)) {
      return raw;
    }
    if (/^\d{11}$/.test(raw)) {
      return `0086${raw}`;
    }
    return raw;
  }

  async function loginWithPassword(username: string, codeOrPass: string) {
    state.value = 'loading';
    try {
      const res = await userStore.login({
        username: normalizeUsername(username),
        password: codeOrPass,
        flag: 1,
        device: buildLoginDevice()
      });
      state.value = 'logged_in';
      return res;
    } catch (err) {
      state.value = 'idle';
      throw err;
    }
  }

  async function sendSmsCode(phone: string) {
    state.value = 'loading';
    try {
      const normalizedPhone = phone.trim().replace(/^0086/, '');
      await authApi.getRegisterSmsCode({ zone: '0086', phone: normalizedPhone });
      state.value = 'sms_sent';
    } catch (err) {
      state.value = 'idle';
      throw err;
    }
  }

  async function startQrLogin() {
    state.value = 'loading';
    qrError.value = '';
    qrAuthCode.value = '';
    try {
      const res: any = await authApi.getLoginUUID();
      qrUuid.value = res?.uuid || res?.login_uuid || res?.data?.uuid || String(res || '');
      if (!qrUuid.value) {
        throw new Error('QR login UUID missing');
      }
      state.value = 'qr_waiting';
      return qrUuid.value;
    } catch (err: any) {
      state.value = 'qr_failed';
      qrError.value = err?.msg || err?.message || 'QR login unavailable';
      throw err;
    }
  }

  async function pollQrLoginStatus() {
    if (!qrUuid.value) {
      state.value = 'qr_failed';
      qrError.value = 'QR login UUID missing';
      return state.value;
    }
    try {
      const res: any = await authApi.getLoginStatus(qrUuid.value);
      const nextState = normalizeQrLoginStatus(res);
      state.value = nextState;
      const authCode = res?.auth_code || res?.authCode || res?.code;
      if (nextState === 'qr_confirmed' && authCode) {
        qrAuthCode.value = authCode;
      }
      return nextState;
    } catch (err: any) {
      state.value = 'qr_failed';
      qrError.value = err?.msg || err?.message || 'QR login status failed';
      throw err;
    }
  }

  async function confirmQrLogin() {
    if (!qrAuthCode.value) {
      await pollQrLoginStatus();
    }
    if (!qrAuthCode.value) {
      throw new Error('QR login not confirmed');
    }
    state.value = 'loading';
    try {
      const res = await authApi.loginWithAuthCode(qrAuthCode.value);
      userStore.applyLoginResult({
        ...(res as any),
        device: buildLoginDevice()
      });
      state.value = 'logged_in';
      return res;
    } catch (err) {
      state.value = 'qr_failed';
      throw err;
    }
  }

  return {
    state,
    qrUuid,
    qrAuthCode,
    qrError,
    loginWithPassword,
    sendSmsCode,
    startQrLogin,
    pollQrLoginStatus,
    confirmQrLogin,
    normalizeUsername
  };
});
