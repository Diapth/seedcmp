import { defineStore } from 'pinia';
import { useConversationStore } from '@/stores/conversation';
import { notifyMessage } from '@/composables/useSystemNotification';

function defaultMsg(overrides = {}) {
  return {
    reactions: [], // [{ emoji, userIds: [], count }]
    replyRef: null, // { messageId, senderName, contentPreview }
    mentions: [], // [{ userId, name, offset }]
    senderAvatar: '',
    status: 'success', // 'sending' | 'success' | 'failed' | 'revoked' | 'edited'
    ...overrides
  };
}

function messageSummary(message) {
  if (message.type === 'image') return '[图片]';
  if (message.type === 'voice') return '[语音]';
  if (message.type === 'file') return `[文件] ${message.fileName || message.name || message.content || ''}`.trim();
  return message.content || '收到一条新消息';
}

export const useMessageStore = defineStore('message', {
  state: () => ({
    messages: {
      '1': [
        { id: '101', senderId: '1', senderName: '张伟', content: '哈罗，最近项目进展怎么样？', type: 'text', time: 1780485000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '102', senderId: 'me', senderName: '我', content: '已经在推进UI优化阶段了，本周能做完。', type: 'text', time: 1780486000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '103', senderId: '1', senderName: '张伟', content: '下午的会议材料准备好了吗？', type: 'text', time: 1780490000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }
      ],
      '2': [
        { id: '201', senderId: '5', senderName: '王五', content: '大家把bug提在这里哈。', type: 'text', time: 1780480000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '202', senderId: '4', senderName: '李四', content: '收到，这个版已经发上去了。', type: 'text', time: 1780489500000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '203', senderId: '5', senderName: '王五', content: '这是刚才整理的测试文档，大家看一下', type: 'text', time: 1780489600000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '204', senderId: '5', senderName: '王五', name: 'test.docx', size: '746 KB', type: 'file', time: 1780489700000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '205', senderId: '4', senderName: '李四', name: 'test.xlsx', size: '12 KB', type: 'file', time: 1780489800000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '206', senderId: '1', senderName: '张伟', name: 'test.pptx', size: '7.5 MB', type: 'file', time: 1780489900000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '207', senderId: 'me', senderName: '我', name: 'test.md', size: '15 KB', type: 'file', time: 1780490000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '208', senderId: '4', senderName: '李四', name: 'test.html', size: '19 KB', type: 'file', time: 1780490100000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '209', senderId: '1', senderName: '张伟', name: 'test.py', size: '13 KB', type: 'file', time: 1780490200000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '210', senderId: '5', senderName: '王五', name: 'usv_layout_front_view.png', size: '62 KB', type: 'file', time: 1780490300000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }
      ],
      'agent-review': [
        { id: 'ar-101', senderId: 'pm-agent', senderName: 'PM 智能体', content: '本轮评审目标：确认看板按群聊归类、日志进入完整 Console 页面、@ 修改仍能写入群聊草稿。', type: 'text', time: 1780490400000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: 'ar-102', senderId: 'codex', senderName: 'Codex', content: 'Console 日志页已经接入，任务卡会跳转到 /pages/agents/log，并保留任务目标、产出文档和完整输出。', type: 'text', time: 1780490500000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: 'ar-103', senderId: 'claude-code', senderName: 'Claude Code', content: '我会重点看群聊信息入口、看板 groupId 预选、移动端 375px 是否有横向溢出。', type: 'text', time: 1780490600000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: 'ar-104', senderId: 'logic-weaver', senderName: '逻辑编织者', content: '同一个智能体跨多个群聊出现时，任务归属以 groupId + taskId 为准，agentId 只表示执行者。', type: 'text', time: 1780490700000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: 'ar-105', senderId: 'clowder', senderName: 'Clowder 协同猫', name: '多智能体协同日志.md', size: '18 KB', type: 'file', time: 1780490800000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }
      ],
      '3': [
        { id: '301', senderId: 'ds', senderName: 'DeepSeek', content: '你好！我是您的AI小助手，随时为您服务。输入您的问题，我将竭诚为您解答！', type: 'text', time: 1780489000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }
      ]
    }
  }),
  actions: {
    sendMessage(conversationId, text, sender = { id: 'me', name: '我' }, type = 'text', extra = {}) {
      if (!this.messages[conversationId]) {
        this.messages[conversationId] = [];
      }

      const newMsg = defaultMsg({
        id: Date.now().toString(),
        senderId: sender.id,
        senderName: sender.name,
        content: text,
        type: type,
        time: Date.now(),
        status: 'sending',
        ...extra
      });

      this.messages[conversationId].push(newMsg);

      // Simulate sending latency
      setTimeout(() => {
        newMsg.status = 'success';
      }, 500);

      return newMsg;
    },
    receiveMessage(conversationId, msg) {
      if (!this.messages[conversationId]) {
        this.messages[conversationId] = [];
      }
      const receivedMsg = defaultMsg({
        time: Date.now(),
        status: 'success',
        ...msg
      });
      this.messages[conversationId].push(receivedMsg);

      const convStore = useConversationStore();
      const conversation = convStore.conversations.find((item) => item.id === conversationId);
      if (conversation) {
        conversation.lastMessage = messageSummary(receivedMsg);
        conversation.lastTime = receivedMsg.time;
        if (convStore.activeId !== conversationId) {
          conversation.unread = (conversation.unread || 0) + 1;
        }
        if (!conversation.isMuted) {
          notifyMessage({ conversation, message: receivedMsg });
        }
      }
      return receivedMsg;
    },
    // PR-9 新增 actions
    reactMessage(conversationId, messageId, emoji, userId = 'me') {
      const list = this.messages[conversationId];
      if (!list) return;
      const msg = list.find((m) => m.id === messageId);
      if (!msg) return;
      if (!msg.reactions) msg.reactions = [];
      const existing = msg.reactions.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.userIds.includes(userId)) {
          existing.userIds = existing.userIds.filter((u) => u !== userId);
          existing.count = Math.max(0, existing.count - 1);
          if (existing.count === 0) {
            msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
          }
        } else {
          existing.userIds.push(userId);
          existing.count += 1;
        }
      } else {
        msg.reactions.push({ emoji, userIds: [userId], count: 1 });
      }
    },
    unreactMessage(conversationId, messageId, emoji, userId = 'me') {
      this.reactMessage(conversationId, messageId, emoji, userId);
    },
    revokeMessage(conversationId, messageId) {
      const list = this.messages[conversationId];
      if (!list) return;
      const msg = list.find((m) => m.id === messageId);
      if (!msg) return;
      msg.status = 'revoked';
      msg.type = 'system';
      msg.content = '你撤回了一条消息';
    },
    deleteMessage(conversationId, messageId) {
      const list = this.messages[conversationId];
      if (!list) return;
      this.messages[conversationId] = list.filter((m) => m.id !== messageId);
    },
    editMessage(conversationId, messageId, newContent) {
      const list = this.messages[conversationId];
      if (!list) return;
      const msg = list.find((m) => m.id === messageId);
      if (!msg) return;
      msg.content = newContent;
      msg.status = 'edited';
    }
  }
});
