<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ChannelAvatar from '../ChannelAvatar.vue';

type DeploymentTargetCandidate = {
  id: string;
  label: string;
  value: string;
  source?: string;
  workspaceId?: string;
  path?: string;
};

type DeploymentEnvironmentCandidate = {
  id: string;
  label: string;
  value: string;
};

const DEFAULT_ENVIRONMENT_CANDIDATES: DeploymentEnvironmentCandidate[] = [
  { id: 'local', label: '本地', value: 'local' },
  { id: 'preview', label: '预览', value: 'preview' },
  { id: 'testing', label: '测试', value: 'testing' },
  { id: 'staging', label: '预发', value: 'staging' },
  { id: 'production', label: '生产', value: 'production' },
];

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
      deploymentRequestId?: string;
      missingFields?: string[];
      disabledReason?: string;
      error?: string;
      targetCandidates?: DeploymentTargetCandidate[];
      environmentCandidates?: DeploymentEnvironmentCandidate[];
      deploymentRequest?: {
        deploymentRequestId?: string;
        text?: string;
        sourceMessageId?: string;
        workspaceId?: string;
        workspacePath?: string;
        targetCatIds?: string[];
        triggerReason?: string;
        promptContext?: string;
      };
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const emit = defineEmits<{
  (event: 'action', payload: { action: 'confirm' | 'cancel'; message: any }): void;
  (event: 'deployment-field-update', payload: { field: 'target' | 'environment'; value: string; message: any }): void;
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
const deploymentEnvironment = computed(() => content.value.environment || content.value.destination || '待确认环境');
const deploymentTargetCandidates = computed(() => Array.isArray(content.value.targetCandidates) ? content.value.targetCandidates : []);
const deploymentEnvironmentCandidates = computed(() => {
  const candidates = Array.isArray(content.value.environmentCandidates) ? content.value.environmentCandidates : [];
  return candidates.length ? candidates : DEFAULT_ENVIRONMENT_CANDIDATES;
});
const deploymentStatus = computed(() => {
  const status = String(content.value.status || 'pending_confirmation');
  if (status === 'needs_fields') return '需要补充信息';
  if (status === 'submitting') return '提交中';
  if (status === 'confirmed' || status === 'queued') return '已排队';
  if (status === 'running') return '部署中';
  if (status === 'succeeded') return '部署成功';
  if (status === 'cancelled' || status === 'canceled') return '已取消';
  if (status === 'failed') return '部署失败';
  return '待确认';
});
const deploymentPreviewUrl = computed(() => String(content.value.previewUrl || '').trim());
const deploymentDownloadUrl = computed(() => String(content.value.downloadUrl || '').trim());
const deploymentLogsSummary = computed(() => Array.isArray(content.value.logsSummary) ? content.value.logsSummary.slice(-3) : []);
const deploymentMissingFields = computed(() => Array.isArray(content.value.missingFields) ? content.value.missingFields : []);
const deploymentActionDisabled = computed(() => {
  const status = String(content.value.status || 'pending_confirmation');
  return ['confirmed', 'queued', 'running', 'succeeded', 'cancelled', 'canceled', 'submitting'].includes(status);
});
const deploymentConfirmDisabled = computed(() => {
  return deploymentActionDisabled.value || deploymentMissingFields.value.length > 0 || String(content.value.status || '') === 'needs_fields';
});
const deploymentDisabledReason = computed(() => {
  if (content.value.disabledReason) return String(content.value.disabledReason);
  if (deploymentMissingFields.value.length > 0) {
    return `请先补充${deploymentMissingFields.value.map((field: string) => field === 'target' ? '部署目标' : '部署环境').join('、')}`;
  }
  return '';
});
const targetDraft = ref('');
const targetHasFocus = ref(false);

function normalizeTargetDraft(value: string) {
  const text = String(value || '').trim();
  return text && text !== '待确认目标' ? text : '';
}

watch(
  () => [deploymentTarget.value, content.value.deploymentRequestId, content.value.target],
  () => {
    if (targetHasFocus.value && targetDraft.value) return;
    targetDraft.value = normalizeTargetDraft(String(content.value.target || content.value.project || ''));
  },
  { immediate: true },
);

function handleDeploymentAction(action: 'confirm' | 'cancel') {
  if (action === 'confirm' && deploymentConfirmDisabled.value) return;
  if (action === 'cancel' && deploymentActionDisabled.value) return;
  emit('action', { action, message: props.message });
}

function emitDeploymentFieldUpdate(field: 'target' | 'environment', value: string) {
  emit('deployment-field-update', { field, value, message: props.message });
}

function commitTargetDraft() {
  const value = targetDraft.value.trim();
  if (!value || value === deploymentTarget.value) return;
  emitDeploymentFieldUpdate('target', value);
}

function handleTargetFocus() {
  targetHasFocus.value = true;
}

function handleTargetBlur() {
  targetHasFocus.value = false;
  commitTargetDraft();
}

function applyTargetCandidate(candidate: DeploymentTargetCandidate) {
  targetDraft.value = candidate.value;
  emitDeploymentFieldUpdate('target', candidate.value);
}

function applyEnvironmentCandidate(candidate: DeploymentEnvironmentCandidate) {
  emitDeploymentFieldUpdate('environment', candidate.value);
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
      <div class="deployment-field">
        <div class="deployment-field-header">
          <span>目标补充</span>
          <span v-if="deploymentMissingFields.includes('target')">待补充</span>
        </div>
        <div class="deployment-input-row">
          <input
            v-model="targetDraft"
            class="deployment-input"
            type="text"
            placeholder="输入部署目标"
            @focus="handleTargetFocus"
            @blur="handleTargetBlur"
            @keydown.enter.prevent="commitTargetDraft"
          />
          <button
            type="button"
            class="deployment-btn inline"
            :disabled="!targetDraft.trim() || targetDraft.trim() === deploymentTarget"
            @click="commitTargetDraft"
          >
            应用
          </button>
        </div>
        <div v-if="deploymentTargetCandidates.length > 0" class="deployment-candidate-list">
          <button
            v-for="candidate in deploymentTargetCandidates"
            :key="candidate.id"
            type="button"
            class="deployment-candidate"
            @click="applyTargetCandidate(candidate)"
          >
            {{ candidate.label }}
          </button>
        </div>
      </div>
      <div class="deployment-field">
        <div class="deployment-field-header">
          <span>环境选择</span>
          <span v-if="deploymentMissingFields.includes('environment')">待补充</span>
        </div>
        <div class="deployment-candidate-list">
          <button
            v-for="candidate in deploymentEnvironmentCandidates"
            :key="candidate.id"
            type="button"
            class="deployment-candidate"
            :class="{ active: deploymentEnvironment === candidate.value }"
            @click="applyEnvironmentCandidate(candidate)"
          >
            {{ candidate.label }}
          </button>
        </div>
      </div>
      <p v-if="deploymentDisabledReason || content.error" class="deployment-hint">
        {{ content.error || deploymentDisabledReason }}
      </p>
      <p v-if="content.failureReason && content.status === 'failed'" class="deployment-hint">
        {{ content.failureReason }}
      </p>
      <div v-if="deploymentPreviewUrl || deploymentDownloadUrl" class="deployment-links">
        <a
          v-if="deploymentPreviewUrl"
          class="deployment-link"
          :href="deploymentPreviewUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          打开预览
        </a>
        <a
          v-if="deploymentDownloadUrl"
          class="deployment-link"
          :href="deploymentDownloadUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          下载源码包
        </a>
      </div>
      <ul v-if="deploymentLogsSummary.length > 0" class="deployment-log-list">
        <li v-for="(line, index) in deploymentLogsSummary" :key="index">{{ line }}</li>
      </ul>
      <div class="deployment-actions">
        <button
          type="button"
          class="deployment-btn primary"
          :disabled="deploymentConfirmDisabled"
          :aria-disabled="deploymentConfirmDisabled"
          :aria-label="deploymentConfirmDisabled && deploymentDisabledReason ? `确认部署：${deploymentDisabledReason}` : '确认部署'"
          :title="deploymentDisabledReason"
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

.deployment-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deployment-field-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  color: var(--text-secondary);
}

.deployment-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.deployment-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 28px;
}

.deployment-input::placeholder {
  color: var(--text-secondary);
}

.deployment-input:focus {
  outline: 1px solid var(--primary-color, #165dff);
  outline-offset: 0;
}

.deployment-candidate-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.deployment-candidate {
  height: 28px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 11px;
  line-height: 26px;
}

.deployment-candidate.active {
  border-color: var(--primary-color, #165dff);
  background: rgba(22, 93, 255, 0.08);
  color: var(--primary-color, #165dff);
}

.deployment-actions {
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

.deployment-hint {
  margin: 0;
  color: #b45309;
  font-size: 12px;
  line-height: 18px;
}

.deployment-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.deployment-link {
  min-height: 28px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--primary-color, #165dff);
  font-size: 12px;
  line-height: 26px;
  text-decoration: none;
}

.deployment-link:hover {
  background: rgba(22, 93, 255, 0.08);
}

.deployment-log-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 16px;
  list-style: none;
}

.deployment-log-list li {
  overflow-wrap: anywhere;
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

.deployment-btn.inline {
  flex: 0 0 auto;
}

.deployment-btn.primary {
  border-color: var(--primary-color, #165dff);
  background: var(--primary-color, #165dff);
  color: #ffffff;
}

.deployment-candidate:hover,
.deployment-btn:hover {
  background-color: var(--bg-hover);
}

.deployment-btn.primary:hover {
  background-color: var(--primary-color, #165dff);
  opacity: 0.92;
}

.deployment-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
