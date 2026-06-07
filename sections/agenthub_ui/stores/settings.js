import { defineStore } from 'pinia';
import { authApi } from '@/api/auth.js';
import { clowderApi } from '@/api/clowder.js';
import { storage } from '@/utils/storage.js';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    devices: [],
    notificationSettings: {
      enableSystemNotifications: true,
      enableSound: true,
      enableVibrate: true,
      doNotDisturb: false,
      permissionStatus: storage.get('notification_permission_status') || 'default',
      showPreview: true
    },
    qrLogin: {
      available: false,
      uuid: '',
      status: 'unavailable',
      message: '二维码登录后端能力待确认'
    },
    skillUpload: {
      available: false,
      status: 'unavailable',
      message: '技能上传后端能力待确认'
    }
  }),
  actions: {
    async fetchDevices() {
      const response = await authApi.getDevices();
      const data = response?.data || response || {};
      this.devices = data.devices || data.items || [];
      return this.devices;
    },
    async removeDevice(deviceId) {
      await authApi.deleteDevice(deviceId);
      this.devices = this.devices.filter((d) => d.id !== deviceId && d.device_id !== deviceId);
    },
    updateNotificationSettings(newSettings) {
      this.notificationSettings = {
        ...this.notificationSettings,
        ...newSettings
      };
      if (newSettings.permissionStatus) {
        storage.set('notification_permission_status', newSettings.permissionStatus);
      }
    },
    async generateQrLoginToken() {
      try {
        const response = await authApi.getLoginUUID();
        const data = response?.data || response || {};
        this.qrLogin = {
          available: true,
          uuid: data.uuid || data.login_uuid || '',
          status: 'pending',
          message: ''
        };
        return this.qrLogin;
      } catch (err) {
        this.qrLogin = {
          available: false,
          uuid: '',
          status: 'unavailable',
          message: err?.message || '二维码登录后端能力待确认'
        };
        return this.qrLogin;
      }
    },
    async uploadSkill(payload) {
      try {
        const response = await clowderApi.uploadSkill(payload);
        this.skillUpload = { available: true, status: 'success', message: '' };
        return response?.data || response || {};
      } catch (err) {
        this.skillUpload = {
          available: false,
          status: 'unavailable',
          message: err?.message || '技能上传后端能力待确认'
        };
        throw err;
      }
    }
  }
});
