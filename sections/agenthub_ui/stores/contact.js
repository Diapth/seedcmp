import { defineStore } from 'pinia';
import { friendApi } from '@/api/friend.js';

function normalizeContact(input = {}) {
  return {
    id: input.uid || input.id || '',
    nickname: input.name || input.nickname || input.remark || '未命名联系人',
    avatar: input.avatar || input.logo || '',
    pinyin: input.pinyin || input.name || input.nickname || '',
    phone: input.phone || '',
    remark: input.remark || '',
    status: input.status || 'offline',
    raw: input
  };
}

export const useContactStore = defineStore('contact', {
  state: () => ({
    contacts: [],
    friendRequests: [],
    blacklist: [],
    loading: false,
    lastError: ''
  }),
  actions: {
    async fetchContacts(keyword = '') {
      this.loading = true;
      try {
        const response = await friendApi.syncFriends({ version: 0, limit: 200, keyword, api_version: 1 });
        const data = response?.data || response || {};
        this.contacts = (data.friends || data.items || []).map(normalizeContact);
        return this.contacts;
      } finally {
        this.loading = false;
      }
    },
    addContact(contact) {
      const normalized = normalizeContact(contact);
      if (!this.contacts.some((item) => item.id === normalized.id)) this.contacts.push(normalized);
      return normalized;
    },
    async acceptRequest(requestId) {
      const req = this.friendRequests.find((item) => item.id === requestId);
      if (!req) return;
      if (req.token) await friendApi.approveFriend(req.token);
      req.status = 'accepted';
      this.addContact(req);
    },
    rejectRequest(requestId) {
      const req = this.friendRequests.find((item) => item.id === requestId);
      if (req) req.status = 'rejected';
    },
    async updateRemark(contactId, remark) {
      await friendApi.updateRemark({ uid: contactId, remark });
      const contact = this.contacts.find((item) => item.id === contactId);
      if (contact) contact.remark = remark;
    },
    upsertContactFromMember(member, remark = '') {
      if (!member?.id || member.id === 'me') return null;
      const existing = this.contacts.find((item) => item.id === member.id);
      if (existing) {
        existing.remark = remark;
        return existing;
      }
      return this.addContact({ ...member, remark });
    },
    async addToBlacklist(contactId) {
      await friendApi.addBlacklist(contactId);
      const contact = this.contacts.find((item) => item.id === contactId);
      if (contact && !this.blacklist.some((item) => item.id === contactId)) this.blacklist.push(contact);
      this.contacts = this.contacts.filter((item) => item.id !== contactId);
    },
    async removeFromBlacklist(contactId) {
      await friendApi.removeBlacklist(contactId).catch(() => undefined);
      const item = this.blacklist.find((entry) => entry.id === contactId);
      this.blacklist = this.blacklist.filter((entry) => entry.id !== contactId);
      if (item) this.addContact(item);
    },
    async sendFriendRequest(toUidOrNickname, message) {
      const response = await friendApi.applyFriend({
        to_uid: toUidOrNickname,
        remark: message || '你好，我想添加你为好友'
      });
      const data = response?.data || response || {};
      const request = {
        id: data.id || data.to_uid || toUidOrNickname,
        nickname: data.name || data.nickname || toUidOrNickname,
        message: message || '你好，我想添加你为好友',
        time: Date.now(),
        status: 'pending',
        token: data.token || ''
      };
      this.friendRequests.unshift(request);
      return request;
    },
    async searchUser(keyword) {
      const response = await friendApi.searchUser(keyword);
      const data = response?.data || response || {};
      return normalizeContact(data.user || data);
    },
    reset() {
      this.contacts = [];
      this.friendRequests = [];
      this.blacklist = [];
      this.loading = false;
      this.lastError = '';
    }
  }
});
