<template>
  <view class="agent-card flex-column justify-between" :class="cardClasses" @click="startChat">
    <view class="corner-wash"></view>
    <view class="agent-header flex-row align-center gap-3">
      <view class="agent-icon">
        <AppIcon name="agents" :size="22" color="currentColor" />
      </view>
      <view class="agent-title-box flex-column flex-1">
        <view class="name-row flex-row align-center justify-between">
          <text class="agent-name">{{ agent.name }}</text>
          <text class="creator-badge" :class="agent.creator.toLowerCase()">
            {{ agent.creator === 'System' ? '官方' : '自定义' }}
          </text>
        </view>
      </view>
    </view>
    
    <view class="agent-body">
      <text class="agent-desc">{{ agent.desc }}</text>
    </view>
    
    <view class="agent-footer flex-row align-center justify-between">
      <view class="status-pill flex-row align-center gap-1" :class="agent.status">
        <view class="status-dot" :class="agent.status" />
        <text class="status-text">{{ statusText }}</text>
      </view>
      <view class="agent-actions flex-row align-center gap-2">
        <button class="btn-config flex-row align-center justify-center gap-2" aria-label="配置智能体" @click.stop="openConfig">
          <AppIcon name="settings" :size="15" color="var(--color-text-secondary)" />
          <text class="btn-config-text">配置</text>
        </button>
        <button class="btn-chat flex-row align-center justify-center gap-2" @click.stop="startChat">
          <text class="btn-text">对话</text>
          <AppIcon name="chat" :size="15" color="var(--color-primary)" />
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useConversationStore } from '@/stores/conversation';
import { useMessageStore } from '@/stores/message';
import AppIcon from '@/components/common/AppIcon.vue';

const props = defineProps({
  agent: {
    type: Object,
    required: true
  },
  variant: {
    type: String,
    default: 'grid'
  }
});

const convStore = useConversationStore();
const msgStore = useMessageStore();

const toneClass = computed(() => {
  const toneMap = {
    'pm-agent': 'tone-green',
    codex: 'tone-primary',
    'claude-code': 'tone-orange',
    ds: 'tone-cyan',
    'logic-weaver': 'tone-purple',
    'creative-spark': 'tone-green',
    clowder: 'tone-orange'
  };
  return toneMap[props.agent.id] || 'tone-primary';
});

const cardClasses = computed(() => [props.variant, toneClass.value]);

const statusText = computed(() => {
  if (props.agent.status === 'active') return '空闲';
  if (props.agent.status === 'busy') return '忙碌';
  return '离线';
});

function startChat() {
  const agent = props.agent;
  
  let conv = convStore.conversations.find(c => c.id === agent.id);
  if (!conv) {
    conv = {
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      type: 'robot',
      unread: 0,
      lastMessage: agent.desc,
      lastTime: Date.now(),
      isPinned: false,
      isMuted: false,
      draft: ''
    };
    convStore.conversations.push(conv);
  }
  
  if (!msgStore.messages[agent.id]) {
    msgStore.messages[agent.id] = [
      {
        id: Date.now().toString(),
        senderId: agent.id,
        senderName: agent.name,
        content: `你好！我是 "${agent.name}"，很高兴为您服务。${agent.desc}`,
        type: 'text',
        time: Date.now(),
        status: 'success'
      }
    ];
  }
  
  convStore.setActiveId(agent.id);
  uni.setStorageSync('active_conversation_id', agent.id);
  uni.redirectTo({
    url: '/pages/chat/index'
  });
}

function openConfig() {
  uni.navigateTo({
    url: `/pages/agents/new?id=${encodeURIComponent(props.agent.id)}`
  });
}
</script>

<style scoped>
.agent-card {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  padding: 20px;
  min-height: 174px;
  box-sizing: border-box;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  cursor: pointer;
  transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.agent-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.09);
  transform: translateY(-1px);
}

.corner-wash {
  position: absolute;
  top: 0;
  right: 0;
  width: 68px;
  height: 68px;
  border-bottom-left-radius: 68px;
  opacity: 0.52;
  pointer-events: none;
}

.agent-header {
  position: relative;
  display: flex;
  z-index: 1;
}

.agent-card.list {
  min-height: 96px;
  display: grid;
  grid-template-columns: minmax(220px, 1.05fr) minmax(260px, 1fr) 236px;
  gap: 20px;
  align-items: center;
}

.agent-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tone-green .agent-icon {
  color: #10b981;
  background-color: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.22);
}
.tone-green .corner-wash {
  background-color: rgba(16, 185, 129, 0.12);
}
.tone-primary .agent-icon {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  border-color: rgba(0, 74, 198, 0.2);
}
.tone-primary .corner-wash {
  background-color: rgba(0, 74, 198, 0.1);
}
.tone-orange .agent-icon {
  color: #f97316;
  background-color: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.22);
}
.tone-orange .corner-wash {
  background-color: rgba(249, 115, 22, 0.1);
}
.tone-cyan .agent-icon {
  color: #06b6d4;
  background-color: rgba(6, 182, 212, 0.1);
  border-color: rgba(6, 182, 212, 0.22);
}
.tone-cyan .corner-wash {
  background-color: rgba(6, 182, 212, 0.1);
}
.tone-purple .agent-icon {
  color: #8b5cf6;
  background-color: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.22);
}
.tone-purple .corner-wash {
  background-color: rgba(139, 92, 246, 0.1);
}

.gap-3 {
  gap: 12px;
}

.agent-title-box {
  min-width: 0;
}

.name-row {
  display: flex;
}

.agent-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.creator-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}
.creator-badge.system {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}
.creator-badge.user {
  background-color: var(--color-bg-muted);
  color: var(--color-text-secondary);
}

.gap-1 {
  gap: 4px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.status-dot.active {
  background-color: var(--color-success);
}
.status-dot.busy {
  background-color: var(--color-warning);
}
.status-dot.inactive {
  background-color: var(--color-text-muted);
}

.status-text {
  font-size: 10px;
  font-weight: 700;
}

.agent-body {
  position: relative;
  z-index: 1;
  margin-top: 18px;
  flex: 1;
}

.agent-card.list .agent-body {
  margin-top: 0;
}

.agent-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.agent-footer {
  position: relative;
  z-index: 1;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
  display: flex;
}

.agent-card.list .agent-footer {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.agent-actions {
  display: flex;
  flex-shrink: 0;
}

.status-pill {
  min-height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid;
  box-sizing: border-box;
}
.status-pill.active {
  color: var(--color-success);
  background-color: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.22);
}
.status-pill.busy {
  color: var(--color-warning);
  background-color: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.22);
}
.status-pill.inactive {
  color: var(--color-text-secondary);
  background-color: var(--color-bg-muted);
  border-color: var(--color-border);
}

.btn-config,
.btn-chat {
  min-height: 36px;
  width: auto;
  background-color: transparent;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  margin: 0;
  transition: background-color 0.18s ease, color 0.18s ease;
}
.btn-config::after,
.btn-chat::after { border: none; }
.btn-config:hover,
.btn-chat:hover {
  background-color: var(--color-primary-light);
}

.btn-config-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.btn-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.gap-2 {
  gap: 6px;
}

@media (max-width: 768px) {
  .agent-card,
  .agent-card.list {
    display: flex;
    min-height: 168px;
    padding: 18px;
  }

  .btn-chat {
    min-height: 44px;
  }

  .btn-config {
    min-height: 44px;
  }

  .agent-footer {
    gap: 12px;
  }

  .agent-actions {
    gap: 4px;
  }
}
</style>
