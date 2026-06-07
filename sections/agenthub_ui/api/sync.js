import { apiDelete, request } from '@/utils/request.js';

export const syncApi = {
  syncConversations(data = { msg_count: 20 }) {
    return request('conversation/sync', { method: 'POST', data });
  },
  ackConversations() {
    return request('conversation/syncack', { method: 'POST' });
  },
  syncConversationExtra(data = { version: 0 }) {
    return request('conversation/extra/sync', { method: 'POST', data });
  },
  updateConversationExtra(channelId, channelType, data = {}) {
    return request(`conversations/${encodeURIComponent(channelId)}/${channelType}/extra`, { method: 'POST', data });
  },
  deleteConversation(channelId, channelType) {
    return apiDelete(`conversations/${encodeURIComponent(channelId)}/${channelType}`);
  },
  syncMessages(data) {
    return request('message/channel/sync', { method: 'POST', data });
  },
  revokeMessage(params) {
    const query = new URLSearchParams(params).toString();
    return request(`message/revoke?${query}`, { method: 'POST' });
  },
  editMessage(data) {
    return request('message/edit', { method: 'POST', data });
  },
  deleteMessage(data) {
    return apiDelete('message', data);
  },
  clearUnread(channelId, channelType, messageSeq = 0) {
    return request('coversation/clearUnread', {
      method: 'PUT',
      data: {
        channel_id: channelId,
        channel_type: channelType,
        unread: 0,
        message_seq: messageSeq
      }
    });
  },
  addReaction(data) {
    return request('reactions', { method: 'POST', data });
  },
  syncReactions(data) {
    return request('reaction/sync', { method: 'POST', data });
  },
  pinMessage(data) {
    return request('message/pinned', { method: 'POST', data });
  }
};
