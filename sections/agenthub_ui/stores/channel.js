import { defineStore } from 'pinia';
import { channelKey } from '@/utils/im-mappers.js';
import { userApi } from '@/api/user.js';
import { groupApi } from '@/api/group.js';

export const useChannelStore = defineStore('channel', {
  state: () => ({
    channels: {},
    loadingKeys: {}
  }),
  actions: {
    upsertChannel(channelId, channelType, patch) {
      const key = channelKey(channelId, channelType);
      this.channels[key] = { id: channelId, channelType, ...(this.channels[key] || {}), ...patch };
      return this.channels[key];
    },
    async fetchChannel(channelId, channelType = 1) {
      const key = channelKey(channelId, channelType);
      if (this.channels[key]) return this.channels[key];
      this.loadingKeys[key] = true;
      try {
        const response = Number(channelType) === 2
          ? await groupApi.getGroupInfo(channelId)
          : await userApi.getUserInfo(channelId);
        const data = response?.data || response || {};
        return this.upsertChannel(channelId, channelType, {
          name: data.name || data.nickname || data.group_name || '未命名',
          avatar: data.avatar || data.logo || '',
          raw: data
        });
      } finally {
        delete this.loadingKeys[key];
      }
    },
    reset() {
      this.channels = {};
      this.loadingKeys = {};
    }
  }
});
