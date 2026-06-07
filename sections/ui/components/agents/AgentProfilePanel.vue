<template>
  <view v-if="agent" class="agent-profile-panel flex-column" :class="{ compact }">
    <view class="agent-hero flex-column align-center">
      <view class="agent-avatar-shell">
        <AppAvatar
          :src="agent.avatar || member?.avatar || ''"
          :text="agent.name || member?.nickname || '智能体'"
          :size="72"
          :status="avatarStatus"
        />
        <view class="agent-avatar-mark">
          <AppIcon name="agents" :size="15" color="#ffffff" />
        </view>
      </view>
      <text class="agent-name">{{ agent.name }}</text>
      <view class="agent-badges flex-row align-center">
        <text class="agent-badge primary">{{ creatorText }}</text>
        <text class="agent-badge" :class="agent.status || 'inactive'">{{ statusText }}</text>
        <text v-if="roleLabel" class="agent-badge">{{ roleLabel }}</text>
      </view>
      <text v-if="agent.alias" class="agent-alias">{{ agent.alias }}</text>
    </view>

    <view class="agent-section flex-column">
      <text class="section-title">一句话介绍</text>
      <text class="agent-desc">{{ agent.desc || '暂无介绍' }}</text>
    </view>

    <view class="agent-section flex-column">
      <text class="section-title">运行信息</text>
      <view class="detail-list flex-column">
        <view v-for="item in detailItems" :key="item.label" class="detail-row flex-row align-center justify-between">
          <view class="detail-label flex-row align-center">
            <AppIcon :name="item.icon" :size="15" color="var(--color-text-muted)" />
            <text>{{ item.label }}</text>
          </view>
          <text class="detail-value">{{ item.value }}</text>
        </view>
      </view>
    </view>

    <view class="agent-section flex-column">
      <text class="section-title">能力标签</text>
      <view v-if="capabilityTags.length" class="tag-list flex-row">
        <text v-for="tag in capabilityTags" :key="tag" class="tag-chip">{{ tag }}</text>
      </view>
      <text v-else class="empty-text">暂无能力标签</text>
    </view>

    <button class="edit-agent-btn flex-row align-center justify-center" @click="emit('edit')">
      <AppIcon name="edit" :size="16" color="#ffffff" />
      <text>修改配置</text>
    </button>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const props = defineProps({
  agent: {
    type: Object,
    default: null
  },
  member: {
    type: Object,
    default: null
  },
  roleLabel: {
    type: String,
    default: ''
  },
  compact: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['edit']);

const statusText = computed(() => {
  if (props.agent?.status === 'active') return '空闲';
  if (props.agent?.status === 'busy') return '忙碌';
  return '离线';
});

const avatarStatus = computed(() => {
  if (props.agent?.status === 'active') return 'online';
  if (props.agent?.status === 'busy') return 'busy';
  return 'offline';
});

const creatorText = computed(() => {
  return props.agent?.creator === 'System' ? '官方' : '自定义';
});

const platformText = computed(() => {
  const map = {
    codex: 'Codex',
    'claude-code': 'Claude Code'
  };
  return map[props.agent?.platform] || props.agent?.platform || '-';
});

const accessModeText = computed(() => {
  const map = {
    oauth: 'OAuth',
    'api-key': 'API Key'
  };
  return map[props.agent?.accessMode] || props.agent?.accessMode || '-';
});

const detailItems = computed(() => [
  { label: '运行平台', value: platformText.value, icon: 'code' },
  { label: '接入方式', value: accessModeText.value, icon: 'lock' },
  { label: '模型', value: props.agent?.model || '-', icon: 'settings' },
  { label: '账号引用', value: props.agent?.accountRef || '-', icon: 'user' }
]);

const capabilityTags = computed(() => {
  return Array.isArray(props.agent?.capabilityTags) ? props.agent.capabilityTags : [];
});
</script>

<style scoped>
.agent-profile-panel {
  min-height: 0;
  gap: 14px;
  padding: 18px;
  box-sizing: border-box;
  overflow-y: auto;
}

.agent-profile-panel.compact {
  padding: 0;
  max-height: 68vh;
}

.agent-hero {
  gap: 8px;
  padding: 6px 0 4px;
  text-align: center;
}

.agent-avatar-shell {
  position: relative;
  width: 72px;
  height: 72px;
}

.agent-avatar-mark {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background-color: var(--color-primary);
  border: 2px solid var(--color-bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.agent-name {
  max-width: 100%;
  font-size: 18px;
  line-height: 1.35;
  font-weight: 800;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-badges {
  gap: 6px;
  max-width: 100%;
  flex-wrap: wrap;
  justify-content: center;
}

.agent-badge {
  min-height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 22px;
  font-weight: 700;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  box-sizing: border-box;
}

.agent-badge.primary {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  border-color: rgba(0, 74, 198, 0.18);
}

.agent-badge.active {
  color: var(--color-success);
  background-color: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.22);
}

.agent-badge.busy {
  color: var(--color-warning);
  background-color: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.22);
}

.agent-badge.inactive {
  color: var(--color-text-secondary);
}

.agent-alias {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.agent-section {
  gap: 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-secondary);
}

.agent-desc {
  font-size: 14px;
  line-height: 1.55;
  color: var(--color-text-primary);
  word-break: break-word;
}

.detail-list {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.detail-row {
  min-height: 44px;
  gap: 10px;
  padding: 0 12px;
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  min-width: 0;
  gap: 8px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.detail-value {
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-list {
  gap: 8px;
  flex-wrap: wrap;
}

.tag-chip {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  line-height: 28px;
  font-weight: 700;
}

.empty-text {
  font-size: 13px;
  color: var(--color-text-muted);
}

.edit-agent-btn {
  min-height: 44px;
  width: 100%;
  gap: 8px;
  margin: 2px 0 0;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  box-sizing: border-box;
}

.edit-agent-btn::after {
  border: none;
}

.edit-agent-btn:active {
  opacity: 0.9;
}

@media (max-width: 768px) {
  .agent-profile-panel {
    gap: 16px;
  }

  .agent-name {
    font-size: 17px;
  }
}
</style>
