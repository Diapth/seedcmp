import { defineStore } from 'pinia';
import { nativeImService } from '@/services/native-im/service';

function errorText(error) {
  return error?.msg || error?.message || '通讯录同步失败';
}

export const useContactStore = defineStore('contact', {
  state: () => ({
    syncState: 'idle',
    searchState: 'idle',
    nativeError: '',
    contacts: [
      { id: '1', nickname: '张伟', avatar: '', pinyin: 'zhangwei', phone: '13800000001', remark: '伟哥', status: 'online', source: 'mock' },
      { id: '4', nickname: '李四', avatar: '', pinyin: 'lisi', phone: '13800000002', remark: '研发', status: 'offline', source: 'mock' },
      { id: '5', nickname: '王五', avatar: '', pinyin: 'wangwu', phone: '13800000003', remark: '架构', status: 'away', source: 'mock' }
    ],
    friendRequests: [
      { id: '1001', nickname: '赵六', message: '我是隔壁王经理介绍的', time: 1780480000000, status: 'pending' }
    ],
    blacklist: [
      { id: '99', nickname: '推销小助手', avatar: '' }
    ]
  }),
  actions: {
    addContact(contact) {
      if (!contact?.id && !contact?.uid) return null;
      const id = String(contact.id || contact.uid);
      const existing = this.contacts.find((item) => item.id === id);
      const normalized = { ...contact, id, uid: id };
      if (existing) {
        Object.assign(existing, normalized);
        return existing;
      }
      this.contacts.push(normalized);
      return normalized;
    },
    acceptRequest(requestId) {
      const idx = this.friendRequests.findIndex(r => r.id === requestId);
      if (idx !== -1) {
        const req = this.friendRequests[idx];
        req.status = 'accepted';
        this.addContact({
          id: req.id,
          nickname: req.nickname,
          avatar: '',
          pinyin: req.nickname,
          phone: '',
          remark: '',
          status: 'offline'
        });
      }
    },
    rejectRequest(requestId) {
      const req = this.friendRequests.find(r => r.id === requestId);
      if (req) {
        req.status = 'rejected';
      }
    },
    updateRemark(contactId, remark) {
      const c = this.contacts.find((item) => item.id === contactId);
      if (c) c.remark = remark;
    },
    upsertContactFromMember(member, remark = '') {
      if (!member?.id || member.id === 'me') return null;
      let contact = this.contacts.find((item) => item.id === member.id);
      if (!contact) {
        contact = {
          id: member.id,
          nickname: member.nickname || member.name || '用户',
          avatar: member.avatar || '',
          pinyin: member.nickname || member.name || '',
          phone: '',
          remark,
          status: member.status || 'offline'
        };
        this.contacts.push(contact);
      } else if (remark !== undefined) {
        contact.remark = remark;
      }
      return contact;
    },
    addToBlacklist(contactId) {
      const c = this.contacts.find(item => item.id === contactId);
      if (c && !this.blacklist.some(b => b.id === contactId)) {
        this.blacklist.push(c);
        this.contacts = this.contacts.filter(item => item.id !== contactId);
      }
    },
    removeFromBlacklist(contactId) {
      const b = this.blacklist.find(item => item.id === contactId);
      if (b) {
        this.blacklist = this.blacklist.filter(item => item.id !== contactId);
        this.contacts.push({ ...b, pinyin: b.nickname, status: 'offline' });
      }
    },
    sendFriendRequest(nickname, message) {
      const id = String(Date.now());
      this.friendRequests.unshift({
        id,
        nickname,
        message: message || '你好，我想添加你为好友',
        time: Date.now(),
        status: 'pending'
      });
    },
    applyNativeContacts(contacts = []) {
      if (contacts.length > 0) {
        this.contacts = this.contacts.filter((contact) => contact.source !== 'mock');
      }
      contacts.forEach((contact) => this.addContact(contact));
    },
    async syncNativeContacts(options = {}) {
      if (!options.silent) this.syncState = 'syncing';
      this.nativeError = '';
      try {
        const contacts = await nativeImService.syncFriends(options);
        this.applyNativeContacts(contacts);
        this.syncState = 'success';
        return contacts;
      } catch (error) {
        this.syncState = 'failed';
        this.nativeError = errorText(error);
        if (!options.silent) throw error;
        return [];
      }
    },
    async searchNativeUser(keyword, context = {}) {
      this.searchState = 'searching';
      this.nativeError = '';
      try {
        const result = await nativeImService.searchUser(keyword, {
          contacts: this.contacts,
          blacklist: this.blacklist,
          ...context
        });
        this.searchState = result ? 'success' : 'empty';
        return result;
      } catch (error) {
        this.searchState = 'failed';
        this.nativeError = errorText(error);
        throw error;
      }
    },
    async sendNativeFriendRequest(target, message) {
      if (!target?.id && !target?.uid) throw { msg: '缺少目标用户' };
      const uid = target.uid || target.id;
      const result = await nativeImService.applyFriend({
        toUid: uid,
        remark: message || '你好，我想添加你为好友',
        vercode: target.vercode || target.raw?.vercode || ''
      });
      this.friendRequests.unshift({
        id: String(uid),
        uid: String(uid),
        nickname: target.nickname || target.name || String(uid),
        avatar: target.avatar || '',
        message: message || '你好，我想添加你为好友',
        time: Date.now(),
        status: 'sent',
        raw: target.raw || target
      });
      return result;
    },
    async fetchNativeFriendRequests(options = {}) {
      try {
        const requests = await nativeImService.fetchFriendRequests(options);
        requests.forEach((request) => {
          const existing = this.friendRequests.find((item) => item.id === request.id || item.token === request.token);
          if (existing) Object.assign(existing, request);
          else this.friendRequests.unshift(request);
        });
        return requests;
      } catch (error) {
        this.nativeError = errorText(error);
        if (!options.silent) throw error;
        return [];
      }
    },
    async approveNativeRequest(requestOrId) {
      const request = typeof requestOrId === 'string'
        ? this.friendRequests.find((item) => item.id === requestOrId)
        : requestOrId;
      if (!request) return null;
      const result = await nativeImService.approveFriendRequest(request);
      request.status = 'accepted';
      this.addContact({
        id: request.uid || request.id,
        nickname: request.nickname,
        avatar: request.avatar || '',
        pinyin: request.nickname,
        phone: '',
        remark: '',
        status: 'offline'
      });
      return result;
    }
  }
});
