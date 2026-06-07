<template>
  <AppSubpageShell>
    <view class="search-page flex-column flex-1">
      <view class="search-header flex-row align-center">
        <view class="back-btn" @click="goBack">
          <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
        </view>
        <view class="search-box flex-row align-center flex-1">
          <AppIcon name="search" :size="18" color="var(--color-text-muted)" />
          <input
            class="search-input flex-1"
            v-model="query"
            :focus="true"
            placeholder="搜索联系人、群组、聊天记录、文件或智能体"
            placeholder-style="color: var(--color-text-muted)"
          />
          <view class="clear-btn" v-if="query" @click="query = ''">
            <AppIcon name="close" :size="14" color="var(--color-text-muted)" />
          </view>
        </view>
      </view>

      <scroll-view scroll-y class="search-scroll flex-1">
        <view class="search-container">
          <view class="hint-panel" v-if="!query.trim()">
            <text class="hint-title">全局搜索</text>
            <text class="hint-desc">可同时查找联系人、群组、聊天记录、文件和智能体。</text>
            <view class="quick-row">
              <view class="quick-chip" v-for="item in quickKeywords" :key="item" @click="query = item">
                <text>{{ item }}</text>
              </view>
            </view>
          </view>

          <template v-else>
            <view class="result-section" v-for="section in sections" :key="section.id">
              <view class="section-header flex-row align-center justify-between">
                <text class="section-title">{{ section.title }}</text>
                <text class="section-count">{{ section.items.length }}</text>
              </view>

              <view class="result-list" v-if="section.items.length">
                <view
                  v-for="item in section.items"
                  :key="item.key"
                  class="result-item flex-row align-center"
                  @click="openResult(item)"
                >
                  <view class="result-icon">
                    <AppIcon :name="item.icon" :size="18" color="var(--color-primary)" />
                  </view>
                  <view class="result-copy flex-column flex-1">
                    <text class="result-title">{{ item.title }}</text>
                    <text class="result-desc">{{ item.desc }}</text>
                  </view>
                  <AppIcon name="chevron-right" :size="14" color="var(--color-text-muted)" />
                </view>
              </view>
              <view class="section-empty" v-else>
                <text class="empty-text">暂无匹配结果</text>
              </view>
            </view>
          </template>

          <view class="empty-state" v-if="query.trim() && totalCount === 0">
            <AppEmptyState
              icon="search"
              title="没有找到相关结果"
              description="换个关键词试试，或检查联系人、文件和会话名称"
            />
          </view>
        </view>
      </scroll-view>
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useNavigationStore } from '@/stores/navigation';
import { useContactStore } from '@/stores/contact';
import { useConversationStore } from '@/stores/conversation';
import { useMessageStore } from '@/stores/message';
import { useFileStore } from '@/stores/file';
import { useAgentStore } from '@/stores/agent';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';

const navStore = useNavigationStore();
const contactStore = useContactStore();
const convStore = useConversationStore();
const messageStore = useMessageStore();
const fileStore = useFileStore();
const agentStore = useAgentStore();

const query = ref('');
const quickKeywords = ['AgentHub', '张伟', '会议', 'DeepSeek'];

onMounted(() => {
  navStore.setActiveModule('chat');
});

const normalizedQuery = computed(() => query.value.trim().toLowerCase());

const sections = computed(() => {
  const q = normalizedQuery.value;
  if (!q) return [];

  const contacts = contactStore.contacts
    .filter(item => matchText(q, item.nickname, item.remark, item.phone, item.pinyin))
    .map(item => ({
      key: `contact-${item.id}`,
      type: 'contact',
      id: item.id,
      title: item.nickname,
      desc: item.remark ? `备注：${item.remark}` : item.phone || '联系人',
      icon: 'user'
    }));

  const conversations = convStore.conversations
    .filter(item => matchText(q, item.name, item.lastMessage))
    .map(item => ({
      key: `conversation-${item.id}`,
      type: 'conversation',
      id: item.id,
      title: item.name,
      desc: item.lastMessage,
      icon: item.type === 'group' ? 'group' : item.type === 'robot' ? 'agents' : 'chat'
    }));

  const records = Object.entries(messageStore.messages)
    .flatMap(([conversationId, messages]) => {
      const conversation = convStore.conversations.find(item => item.id === conversationId);
      return messages
        .filter(item => matchText(q, item.content, item.senderName))
        .slice(0, 4)
        .map(item => ({
          key: `message-${conversationId}-${item.id}`,
          type: 'conversation',
          id: conversationId,
          title: conversation?.name || item.senderName,
          desc: `${item.senderName}: ${item.content}`,
          icon: 'chat'
        }));
    });

  const files = fileStore.files
    .filter(item => matchText(q, item.name, item.type, item.size))
    .map(item => ({
      key: `file-${item.id}`,
      type: 'files',
      id: item.id,
      title: item.name,
      desc: `${item.type.toUpperCase()} · ${item.size}`,
      icon: 'files'
    }));

  const agents = agentStore.agents
    .filter(item => matchText(q, item.name, item.desc))
    .map(item => ({
      key: `agent-${item.id}`,
      type: 'agent',
      id: item.id,
      title: item.name,
      desc: item.desc,
      icon: 'agents'
    }));

  return [
    { id: 'contacts', title: '联系人', items: contacts },
    { id: 'conversations', title: '会话与群组', items: conversations },
    { id: 'records', title: '聊天记录', items: records },
    { id: 'files', title: '文件', items: files },
    { id: 'agents', title: '智能体', items: agents }
  ];
});

const totalCount = computed(() => {
  return sections.value.reduce((sum, section) => sum + section.items.length, 0);
});

function matchText(queryText, ...parts) {
  return parts
    .filter(Boolean)
    .some(part => String(part).toLowerCase().includes(queryText));
}

function openResult(item) {
  if (item.type === 'agent') {
    const agent = agentStore.agents.find(agentItem => agentItem.id === item.id);
    if (agent && !convStore.getConversation(agent.id, 1)) {
      convStore.addOrUpdateConversation(agent.id, 1, {
        name: agent.name,
        avatar: agent.avatar,
        type: 'robot',
        unread: 0,
        lastMessage: agent.desc,
        lastTime: Date.now(),
        isPinned: false,
        isMuted: false,
        draft: ''
      });
    }
    if (agent && !messageStore.getMessages(agent.id, 1).length) {
      messageStore.addMessage(agent.id, {
        id: Date.now().toString(),
        senderId: agent.id,
        senderName: agent.name,
        content: `你好！我是 "${agent.name}"，很高兴为您服务。${agent.desc}`,
        type: 'text',
        time: Date.now(),
        status: 'success',
        channelType: 1
      }, 1);
    }
    convStore.setActiveId(item.id, 1);
    uni.setStorageSync('active_conversation_id', item.id);
    uni.redirectTo({ url: '/pages/chat/index' });
  } else if (item.type === 'conversation') {
    convStore.setActiveId(item.id, item.channelType || item.type || 1);
    uni.setStorageSync('active_conversation_id', item.id);
    uni.redirectTo({ url: '/pages/chat/index' });
  } else if (item.type === 'files') {
    uni.redirectTo({ url: '/pages/files/index' });
  } else {
    uni.redirectTo({ url: '/pages/contacts/index' });
  }
}

function goBack() {
  uni.navigateBack({
    fail: () => uni.redirectTo({ url: '/pages/chat/index' })
  });
}
</script>

<style scoped>
.search-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.search-header {
  min-height: 64px;
  padding: 0 24px;
  gap: 14px;
  background-color: var(--color-glass-bg);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(12px);
  box-sizing: border-box;
}

.back-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn:hover {
  background-color: var(--color-bg-hover);
}

.search-box {
  min-height: 44px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  padding: 0 12px;
  gap: 10px;
  box-sizing: border-box;
}

.search-input {
  height: 42px;
  font-size: 15px;
  color: var(--color-text-primary);
}

.clear-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.search-scroll {
  height: 100%;
}

.search-container {
  width: min(900px, 100%);
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
}

.hint-panel,
.result-section {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 18px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 16px;
}

.hint-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.hint-desc {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.quick-chip {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  background-color: var(--color-bg-muted);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  font-size: 13px;
  cursor: pointer;
}

.section-header {
  display: flex;
  margin-bottom: 10px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.section-count {
  min-width: 24px;
  height: 22px;
  border-radius: 999px;
  background-color: var(--color-bg-muted);
  color: var(--color-text-secondary);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-list {
  display: flex;
  flex-direction: column;
}

.result-item {
  min-height: 64px;
  gap: 12px;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
}

.result-item:hover {
  background-color: var(--color-bg-muted);
}

.result-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background-color: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.result-copy {
  min-width: 0;
  gap: 4px;
}

.result-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-empty {
  padding: 14px 0 0;
  border-top: 1px solid var(--color-border);
}

.empty-text {
  font-size: 12px;
  color: var(--color-text-muted);
}

.empty-state {
  margin-top: 24px;
}

@media (max-width: 768px) {
  .search-header {
    min-height: 56px;
    padding: 0 12px;
    gap: 8px;
  }

  .search-container {
    padding: 16px;
  }
}
</style>
