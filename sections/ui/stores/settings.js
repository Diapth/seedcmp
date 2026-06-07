import { defineStore } from 'pinia';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    devices: [
      { id: 'dev1', name: 'iPhone 15 Pro (当前设备)', type: 'mobile', lastActive: '刚刚', location: '北京' },
      { id: 'dev2', name: 'MacBook Pro 16"', type: 'desktop', lastActive: '2小时前', location: '北京' },
      { id: 'dev3', name: 'Chrome Browser (Windows)', type: 'web', lastActive: '1天前', location: '上海' }
    ],
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
    removeDevice(deviceId) {
      this.devices = this.devices.filter(d => d.id !== deviceId);
    },
    updateNotificationSettings(newSettings) {
      this.notificationSettings = {
        ...this.notificationSettings,
        ...newSettings
      };
    }
  }
});
