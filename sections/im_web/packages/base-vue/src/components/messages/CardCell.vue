<script setup lang="ts">
import { computed } from 'vue';
import ChannelAvatar from '../ChannelAvatar.vue';

const props = defineProps<{
  message: {
    content?: {
      uid?: string;
      name?: string;
      avatar?: string;
      cardType?: string;
      kind?: string;
      title?: string;
      target?: string;
      project?: string;
      environment?: string;
      destination?: string;
      status?: string;
      confirmText?: string;
      cancelText?: string;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const emit = defineEmits<{
  (event: 'action', payload: { action: 'confirm' | 'cancel'; message: any }): void;
}>();

const content = computed(() => props.message.content || props.message.payload || {});
const name = computed(() => props.message.content?.name || props.message.payload?.name || '未知用户');
const avatar = computed(() => props.message.content?.avatar || props.message.payload?.avatar || '');
const cardUid = computed(() => props.message.content?.uid || props.message.payload?.uid || '');
const isDeploymentCard = computed(() => {
  const type = String(content.value.cardType || content.value.kind || '').toLowerCase();
  return ['deployment', 'deploy', 'deployment_confirmation', 'deploy_confirmation'].includes(type);
});
const deploymentTitle = computed(() => content.value.title || '部署确认');
const deploymentTarget = computed(() => content.value.target || content.value.project || '待确认目标');
const deploymentEnvironment = computed(() => content.value.environment || content.value.destination || '未指定环境');
const deploymentStatus = computed(() => {
  const status = String(content.value.status || 'pending_confirmation');
  if (status === 'confirmed' || status === 'running') return '已确认，等待执行';
  if (status === 'cancelled' || status === 'canceled') return '已取消';
  if (status === 'failed') return '确认失败，可重试';
  return '待确认';
});
const deploymentActionDisabled = computed(() => {
  const status = String(content.value.status || 'pending_confirmation');
  return ['confirmed', 'running', 'cancelled', 'canceled'].includes(status);
});

function handleDeploymentAction(action: 'confirm' | 'cancel') {
  if (deploymentActionDisabled.value) return;
  emit('action', { action, message: props.message });
}
</script>

<template>
  <div class="card-cell" :class="{ 'is-me': isMe }">
    <div v-if="isDeploymentCard" class="bubble deployment-card">
      <div class="deployment-header">
        <span class="deployment-eyebrow">Deployment</span>
        <span class="deployment-status">{{ deploymentStatus }}</span>
      </div>
      <div class="deployment-title">{{ deploymentTitle }}</div>
      <dl class="deployment-meta">
        <div>
          <dt>目标</dt>
          <dd>{{ deploymentTarget }}</dd>
        </div>
        <div>
          <dt>环境</dt>
          <dd>{{ deploymentEnvironment }}</dd>
        </div>
      </dl>
      <div class="deployment-actions">
        <button
          type="button"
          class="deployment-btn primary"
          :disabled="deploymentActionDisabled"
          aria-label="确认部署"
          @click="handleDeploymentAction('confirm')"
        >
          {{ content.confirmText || '确认' }}
        </button>
        <button
          type="button"
          class="deployment-btn"
          :disabled="deploymentActionDisabled"
          @click="handleDeploymentAction('cancel')"
        >
          {{ content.cancelText || '取消' }}
        </button>
      </div>
    </div>

    <div v-else class="bubble">
      <div class="card-header">
        <ChannelAvatar :avatar="avatar" :name="name" :size="38" />
        <span class="card-name">{{ name }}</span>
      </div>
      <div class="card-footer">
        <span class="footer-label">个人名片</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-cell {
  display: flex;
  width: 100%;
}

.bubble {
  width: 220px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: var(--border-hairline);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: background-color 0.2s;
}

.bubble:hover {
  background-color: var(--bg-hover);
}

.card-header {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: var(--border-hairline);
}

.card-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer {
  padding: 6px 14px;
  background-color: var(--bg-secondary);
}

.footer-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.card-cell.is-me {
  justify-content: flex-end;
}

.deployment-card {
  width: min(320px, 100%);
  padding: 12px;
  gap: 10px;
  cursor: default;
}

.deployment-card:hover {
  background-color: var(--bg-primary);
}

.deployment-header,
.deployment-meta div,
.deployment-actions {
  display: flex;
  align-items: center;
}

.deployment-header {
  justify-content: space-between;
  gap: 10px;
}

.deployment-eyebrow {
  color: #0f766e;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.deployment-status {
  color: var(--text-secondary);
  font-size: 11px;
}

.deployment-title {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.deployment-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.deployment-meta div {
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.deployment-meta dt,
.deployment-meta dd {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
}

.deployment-meta dt {
  flex: 0 0 auto;
  color: var(--text-secondary);
}

.deployment-meta dd {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deployment-actions {
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

.deployment-btn {
  height: 30px;
  padding: 0 12px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  line-height: 28px;
}

.deployment-btn.primary {
  border-color: var(--primary-color, #165dff);
  background: var(--primary-color, #165dff);
  color: #ffffff;
}

.deployment-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
