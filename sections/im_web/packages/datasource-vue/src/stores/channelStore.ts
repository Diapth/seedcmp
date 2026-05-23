import { defineStore } from 'pinia';
import { ref } from 'vue';
import { commonApi, groupApi } from '../api';

export interface ChannelInfo {
  channel_id: string;
  channel_type: number;
  name: string;
  avatar: string;
  mute: number;
  top: number;
  save: number;
  notice?: string;
  [key: string]: any;
}

export const useChannelStore = defineStore('channel', () => {
  const channels = ref<Record<string, ChannelInfo>>({});
  const members = ref<Record<string, any[]>>({});
  const resetVersion = ref(0);

  // Get channel detail, with caching
  async function getChannelInfo(channelId: string, channelType: number): Promise<ChannelInfo> {
    const key = `${channelId}-${channelType}`;
    if (channels.value[key]) return channels.value[key];
    const version = resetVersion.value;

    try {
      const res: any = await commonApi.getChannelInfo(channelId, channelType);
      if (version !== resetVersion.value) {
        return {
          channel_id: channelId,
          channel_type: channelType,
          name: channelType === 1 ? '用户' : '群聊',
          avatar: '',
          mute: 0,
          top: 0,
          save: 0
        };
      }
      if (res) {
        channels.value[key] = {
          channel_id: channelId,
          channel_type: channelType,
          // 后端返回字段: name, mute(0/1), stick(=top), logo(=avatar), remark
          name: (res.remark && res.remark !== '') ? res.remark : (res.name || ''),
          avatar: res.logo || res.avatar || '',
          mute: res.mute === 1 ? 1 : 0,
          top: res.stick === 1 ? 1 : (res.top === 1 ? 1 : 0),
          save: res.save || 0,
          notice: res.notice || '',
          ...res
        };
        return channels.value[key];
      }
    } catch (e) {
      console.error(`Failed to fetch channel info for ${key}`, e);
    }

    return {
      channel_id: channelId,
      channel_type: channelType,
      name: channelType === 1 ? '用户' : '群聊',
      avatar: '',
      mute: 0,
      top: 0,
      save: 0
    };
  }

  // Update channel info locally (e.g., CMD event, update mute, etc.)
  function updateChannelInfo(channelId: string, channelType: number, updates: Partial<ChannelInfo>) {
    const key = `${channelId}-${channelType}`;
    if (channels.value[key]) {
      channels.value[key] = {
        ...channels.value[key],
        ...updates
      };
    } else {
      channels.value[key] = {
        channel_id: channelId,
        channel_type: channelType,
        name: '',
        avatar: '',
        mute: 0,
        top: 0,
        save: 0,
        ...updates
      } as ChannelInfo;
    }
  }

  // Get group members
  async function fetchGroupMembers(groupNo: string) {
    const version = resetVersion.value;
    try {
      const res: any = await groupApi.getGroupMembers(groupNo, { page: 1, limit: 1000 });
      if (version !== resetVersion.value) return;
      if (res && res.list) {
        members.value[groupNo] = res.list;
      }
    } catch (e) {
      console.error(`Failed to fetch group members for ${groupNo}`, e);
    }
  }

  function reset() {
    resetVersion.value++;
    channels.value = {};
    members.value = {};
  }

  return {
    channels,
    members,
    getChannelInfo,
    updateChannelInfo,
    fetchGroupMembers,
    reset
  };
});
