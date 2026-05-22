import { defineStore } from 'pinia';
import { ref } from 'vue';
import { commonApi, groupApi } from '../api';
export const useChannelStore = defineStore('channel', () => {
    const channels = ref({});
    const members = ref({});
    // Get channel detail, with caching
    async function getChannelInfo(channelId, channelType) {
        const key = `${channelId}-${channelType}`;
        if (channels.value[key])
            return channels.value[key];
        try {
            const res = await commonApi.getChannelInfo(channelId, channelType);
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
        }
        catch (e) {
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
    function updateChannelInfo(channelId, channelType, updates) {
        const key = `${channelId}-${channelType}`;
        if (channels.value[key]) {
            channels.value[key] = {
                ...channels.value[key],
                ...updates
            };
        }
        else {
            channels.value[key] = {
                channel_id: channelId,
                channel_type: channelType,
                name: '',
                avatar: '',
                mute: 0,
                top: 0,
                save: 0,
                ...updates
            };
        }
    }
    // Get group members
    async function fetchGroupMembers(groupNo) {
        try {
            const res = await groupApi.getGroupMembers(groupNo, { page: 1, limit: 1000 });
            if (res && res.list) {
                members.value[groupNo] = res.list;
            }
        }
        catch (e) {
            console.error(`Failed to fetch group members for ${groupNo}`, e);
        }
    }
    return {
        channels,
        members,
        getChannelInfo,
        updateChannelInfo,
        fetchGroupMembers
    };
});
