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

export const useLoginStore = defineStore('loginState', () => {
  const state = ref<'idle' | 'loading' | 'sms_sent' | 'qr_waiting' | 'logged_in'>('idle');
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

  return {
    state,
    loginWithPassword,
    sendSmsCode,
    normalizeUsername
  };
});
