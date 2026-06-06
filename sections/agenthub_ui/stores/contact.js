import { defineStore } from 'pinia';

export const useContactStore = defineStore('contact', {
  state: () => ({
    contacts: [
      { id: '1', nickname: '张伟', avatar: '', pinyin: 'zhangwei', phone: '13800000001', remark: '伟哥', status: 'online' },
      { id: '4', nickname: '李四', avatar: '', pinyin: 'lisi', phone: '13800000002', remark: '研发', status: 'offline' },
      { id: '5', nickname: '王五', avatar: '', pinyin: 'wangwu', phone: '13800000003', remark: '架构', status: 'away' }
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
      this.contacts.push(contact);
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
    }
  }
});
