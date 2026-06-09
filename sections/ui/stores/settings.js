import { defineStore } from 'pinia';
import { nativeImService } from '@/services/native-im/service';
import { resolveSelfId } from '@/services/native-im/message-state';

const MOCK_DEVICES = [
  { id: 'dev1', name: 'iPhone 15 Pro', type: 'mobile', lastActive: '刚刚', location: '北京', isCurrent: true, source: 'mock' },
  { id: 'dev2', name: 'MacBook Pro 16"', type: 'desktop', lastActive: '2小时前', location: '北京', isCurrent: false, source: 'mock' },
  { id: 'dev3', name: 'Chrome Browser (Windows)', type: 'web', lastActive: '1天前', location: '上海', isCurrent: false, source: 'mock' }
];

function storageAvailable() {
  return typeof uni !== 'undefined'
    && typeof uni.getStorageSync === 'function'
    && typeof uni.setStorageSync === 'function';
}

function removedDeviceStorageKey() {
  let uid = '';
  if (storageAvailable()) {
    try {
      const rawUser = uni.getStorageSync('app_user');
      uid = rawUser ? resolveSelfId(JSON.parse(rawUser)) : '';
    } catch {
      uid = '';
    }
    uid = uid || uni.getStorageSync('app_user_uid') || 'guest';
  }
  return `agenthub:removed-devices:${uid || 'guest'}`;
}

function readRemovedDeviceIds() {
  if (!storageAvailable()) return new Set();
  try {
    const value = uni.getStorageSync(removedDeviceStorageKey());
    const ids = Array.isArray(value) ? value : JSON.parse(value || '[]');
    return new Set(ids.map(String).filter(Boolean));
  } catch {
    return new Set();
  }
}

function writeRemovedDeviceIds(ids) {
  if (!storageAvailable()) return;
  uni.setStorageSync(removedDeviceStorageKey(), JSON.stringify([...ids]));
}

function fallbackDevices() {
  const removed = readRemovedDeviceIds();
  return MOCK_DEVICES.filter((device) => !removed.has(device.id)).map((device) => ({ ...device }));
}

function errorText(error) {
  return error?.msg || error?.message || '设备同步失败';
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    devices: fallbackDevices(),
    deviceSyncState: 'idle',
    deviceSyncError: '',
    deviceLogoutIds: [],
    notificationSettings: {
      enableSystemNotifications: true,
      enableSound: true,
      enableVibrate: true,
      doNotDisturb: false,
      permissionStatus: 'default',
      showPreview: true
    }
  }),
  actions: {
    isDeviceLoggingOut(deviceId) {
      return this.deviceLogoutIds.includes(String(deviceId || ''));
    },
    removeDevice(deviceId) {
      const id = String(deviceId || '');
      if (!id) return;
      const removed = readRemovedDeviceIds();
      removed.add(id);
      writeRemovedDeviceIds(removed);
      this.devices = this.devices.filter(d => d.id !== id);
    },
    async syncDevices(options = {}) {
      if (!options.silent) this.deviceSyncState = 'syncing';
      this.deviceSyncError = '';
      try {
        const devices = await nativeImService.fetchDevices();
        this.devices = devices.length ? devices : [];
        this.deviceSyncState = 'success';
        return this.devices;
      } catch (error) {
        this.devices = fallbackDevices();
        this.deviceSyncState = 'failed';
        this.deviceSyncError = errorText(error);
        if (!options.silent) throw error;
        return this.devices;
      }
    },
    async logoutDevice(device) {
      const id = String(device?.id || device?.deviceId || '');
      if (!id) throw { msg: '设备ID不能为空' };
      if (device?.isCurrent) throw { msg: '当前设备不能下线' };
      if (this.isDeviceLoggingOut(id)) return { skipped: true };
      this.deviceLogoutIds = [...this.deviceLogoutIds, id];
      try {
        if (device?.source !== 'mock') {
          await nativeImService.deleteDevice(id);
        }
        this.removeDevice(id);
        return { removed: true };
      } catch (error) {
        this.deviceSyncError = errorText(error);
        throw error;
      } finally {
        this.deviceLogoutIds = this.deviceLogoutIds.filter((item) => item !== id);
      }
    },
    updateNotificationSettings(newSettings) {
      this.notificationSettings = {
        ...this.notificationSettings,
        ...newSettings
      };
    }
  }
});
