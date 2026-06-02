<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { useClowderStore, type ClowderCatContact } from '@tsdaodao/datasource-vue';

const router = useRouter();
const clowderStore = useClowderStore();
const searchQuery = ref('');
const feedback = ref('');

const form = reactive({
  name: '',
  alias: '',
  roleTemplateId: '',
  clientId: '' as '' | 'openai' | 'anthropic',
  authType: '' as '' | 'api_key' | 'oauth',
  accountRef: '',
  defaultModel: '',
  personality: '',
  capabilitiesText: ''
});

const canCreate = computed(() => form.name.trim().length > 0 &&
  form.clientId !== '' &&
  form.authType !== '' &&
  form.accountRef.trim().length > 0);

const roleTemplateOptions = computed(() => clowderStore.catContactDirectory.filter(cat =>
  cat.source === 'disconnected'
));

const selectedRoleTemplate = computed(() =>
  roleTemplateOptions.value.find(cat => cat.catId === form.roleTemplateId)
);

const availableCats = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const cats = clowderStore.catContactDirectory;
  if (!query) return cats;
  return cats.filter(cat => [
    cat.displayName,
    cat.catId,
    ...cat.aliases,
    cat.personalitySummary,
    cat.capabilitySummary
  ].some(value => String(value || '').toLowerCase().includes(query)));
});

onMounted(() => {
  loadDirectory();
});

async function loadDirectory() {
  feedback.value = '';
  await clowderStore.loadCatContactDirectory({
    query: searchQuery.value.trim() || undefined,
    includeUnavailable: true
  }).catch(error => {
    feedback.value = error instanceof Error ? error.message : '猫猫目录加载失败';
  });
}

function resetForm() {
  form.name = '';
  form.alias = '';
  form.roleTemplateId = '';
  form.clientId = '';
  form.authType = '';
  form.accountRef = '';
  form.defaultModel = '';
  form.personality = '';
  form.capabilitiesText = '';
  feedback.value = '';
}

function applyRoleTemplate() {
  const template = selectedRoleTemplate.value;
  if (!template) return;
  if (!form.personality.trim()) form.personality = template.personalitySummary;
  if (!form.capabilitiesText.trim()) form.capabilitiesText = template.capabilitySummary;
}

function openCat(cat: ClowderCatContact) {
  router.push(`/chat/conversation/${cat.directConversationId}/1`);
}

async function connectCat(cat: ClowderCatContact) {
  feedback.value = '';
  const connected = await clowderStore.connectExistingCat(cat.catId).catch(error => {
    feedback.value = error instanceof Error ? error.message : '添加猫猫联系人失败';
    return undefined;
  });
  if (connected) openCat(connected);
}

async function createCatAndConnect() {
  if (!canCreate.value) return;
  const clientId = form.clientId;
  const authType = form.authType;
  if (!clientId || !authType) return;
  feedback.value = '';
  const capabilities = form.capabilitiesText
    .split(/[,\n，]/)
    .map(item => item.trim())
    .filter(Boolean);
  const cat = await clowderStore.createCatAndConnect({
    name: form.name.trim(),
    alias: form.alias.trim() || undefined,
    roleTemplateId: form.roleTemplateId || undefined,
    clientId,
    authType,
    accountRef: form.accountRef.trim(),
    defaultModel: form.defaultModel.trim() || undefined,
    personality: form.personality.trim() || undefined,
    capabilities: capabilities.length > 0 ? capabilities : undefined
  }).catch(error => {
    feedback.value = error instanceof Error ? error.message : '创建猫猫并连接失败';
    return undefined;
  });
  if (cat) {
    resetForm();
    feedback.value = `已连接 ${cat.displayName}`;
    openCat(cat);
  }
}

function back() {
  router.push('/chat');
}
</script>

<template>
  <div class="cat-console-page">
    <div class="page-header">
      <button class="icon-btn" title="返回" @click="back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h3>新增猫猫</h3>
        <span>连接 Clowder 猫猫联系人，用于直聊、群聊邀请和 @ 路由</span>
      </div>
    </div>

    <div class="console-layout">
      <section class="console-section">
        <div class="section-title">猫猫设置</div>
        <label class="field">
          <span>角色模板</span>
          <select v-model="form.roleTemplateId" @change="applyRoleTemplate">
            <option value="">选择 roleTemplates 角色模板</option>
            <option v-for="template in roleTemplateOptions" :key="template.catId" :value="template.catId">
              {{ template.displayName }} · {{ template.capabilitySummary || template.catId }}
            </option>
          </select>
        </label>
        <div v-if="selectedRoleTemplate" class="template-preview">
          <span class="template-name">{{ selectedRoleTemplate.displayName }}</span>
          <span>{{ selectedRoleTemplate.personalitySummary || '未声明性格设定' }}</span>
          <span class="muted">{{ selectedRoleTemplate.capabilitySummary || '未声明能力标签' }}</span>
        </div>
        <label class="field">
          <span>名称</span>
          <input v-model="form.name" placeholder="例如：代码助手" />
        </label>
        <label class="field">
          <span>@ 别名</span>
          <input v-model="form.alias" placeholder="例如：@codex" />
        </label>
        <label class="field">
          <span>运行平台</span>
          <select v-model="form.clientId">
            <option value="">请选择 Codex 或 Claude Code</option>
            <option value="openai">Codex</option>
            <option value="anthropic">Claude Code</option>
          </select>
        </label>
        <label class="field">
          <span>添加方式</span>
          <select v-model="form.authType">
            <option value="">请选择 API Key 账号或 OAuth 账号</option>
            <option value="api_key">API Key 账号</option>
            <option value="oauth">OAuth 账号</option>
          </select>
        </label>
        <label class="field">
          <span>账号引用</span>
          <input
            v-model="form.accountRef"
            :placeholder="form.authType === 'oauth' ? '例如：codex / claude' : '例如：openai-prod / anthropic-prod'"
          />
        </label>
        <label v-if="form.authType === 'api_key'" class="field">
          <span>默认模型</span>
          <input v-model="form.defaultModel" placeholder="API Key 账号需要时填写，例如 gpt-4.1 或 claude-sonnet-4" />
        </label>
        <label class="field">
          <span>性格设定</span>
          <textarea v-model="form.personality" rows="4" placeholder="定义这只猫猫的语气、边界和协作方式"></textarea>
        </label>
        <label class="field">
          <span>能力标签</span>
          <textarea v-model="form.capabilitiesText" rows="3" placeholder="例如：代码审查, 测试, 文档总结"></textarea>
        </label>
        <div v-if="feedback || clowderStore.error" class="feedback">
          {{ feedback || clowderStore.error }}
        </div>
        <div class="form-actions">
          <button class="secondary-btn" @click="resetForm">清空</button>
          <button class="primary-btn" :disabled="!canCreate || clowderStore.loading" @click="createCatAndConnect">
            创建猫猫并连接
          </button>
        </div>
      </section>

      <section class="console-section">
        <div class="section-header">
          <div class="section-title">Clowder 猫猫联系人</div>
          <button class="secondary-btn compact" :disabled="clowderStore.loading" @click="loadDirectory">
            刷新目录
          </button>
        </div>
        <label class="field search-field">
          <span>搜索已有猫猫</span>
          <input
            v-model="searchQuery"
            placeholder="按名称、别名、能力搜索"
            @keydown.enter="loadDirectory"
          />
        </label>
        <div v-if="availableCats.length === 0" class="empty-state">
          暂无可连接猫猫
        </div>
        <div v-else class="cat-list">
          <div v-for="cat in availableCats" :key="cat.id" class="cat-row" :class="{ unavailable: !cat.available }">
            <ChannelAvatar :avatar="cat.avatar" :name="cat.displayName" :size="40" />
            <div class="cat-main">
              <div class="cat-title">
                <span class="cat-name">{{ cat.displayName }}</span>
                <span class="cat-badge">猫猫</span>
                <span v-if="cat.connected" class="cat-connected">已连接</span>
                <span v-else-if="!cat.available" class="cat-unavailable">不可用</span>
              </div>
              <span class="cat-meta">{{ cat.aliases.join(' / ') || cat.catId }}</span>
              <span class="cat-summary">{{ cat.personalitySummary || 'Clowder 联系人' }}</span>
              <span class="cat-summary muted">{{ cat.capabilitySummary || '暂未声明能力' }}</span>
            </div>
            <button
              v-if="cat.connected"
              class="secondary-btn compact"
              @click="openCat(cat)"
            >
              打开会话
            </button>
            <button
              v-else
              class="primary-btn compact"
              :disabled="!cat.available || clowderStore.loading"
              @click="connectCat(cat)"
            >
              添加到联系人
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cat-console-page {
  height: 100%;
  overflow: auto;
  background-color: var(--bg-primary);
}

.page-header {
  min-height: 64px;
  padding: 0 20px;
  border-bottom: var(--border-hairline);
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-header h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-primary);
}

.page-header span {
  font-size: 12px;
  color: var(--text-secondary);
}

.console-layout {
  display: grid;
  grid-template-columns: minmax(320px, 480px) minmax(320px, 1fr);
  gap: 20px;
  padding: 20px;
}

.console-section {
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  padding: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-title {
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.section-header .section-title {
  margin-bottom: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.field input,
.field select,
.field textarea {
  width: 100%;
  box-sizing: border-box;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  padding: 9px 10px;
  font-size: 13px;
}

.field textarea {
  resize: vertical;
  line-height: 1.5;
}

.search-field {
  margin-bottom: 14px;
}

.feedback {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}

.template-preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: -4px 0 12px;
  padding: 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.template-name {
  color: var(--text-primary);
  font-weight: 600;
}

.muted {
  color: var(--text-tertiary, var(--text-secondary));
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.primary-btn,
.secondary-btn,
.icon-btn {
  height: 32px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.primary-btn,
.secondary-btn {
  padding: 0 14px;
  font-size: 13px;
}

.primary-btn {
  border: none;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
}

.primary-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  border: var(--border-hairline);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.compact {
  height: 28px;
  padding: 0 10px;
  white-space: nowrap;
}

.icon-btn {
  width: 32px;
  border: var(--border-hairline);
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.svg-icon {
  width: 17px;
  height: 17px;
}

.empty-state {
  padding: 28px 0;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.cat-list {
  display: flex;
  flex-direction: column;
}

.cat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 76px;
  padding: 10px 0;
  border-bottom: var(--border-hairline);
}

.cat-row:last-child {
  border-bottom: none;
}

.cat-row.unavailable {
  opacity: 0.72;
}

.cat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cat-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.cat-name {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-badge,
.cat-connected,
.cat-unavailable {
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 600;
}

.cat-badge {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.1);
}

.cat-connected {
  color: var(--primary-color, #165dff);
  background: rgba(22, 93, 255, 0.08);
}

.cat-unavailable {
  color: #a16207;
  background: rgba(161, 98, 7, 0.1);
}

.cat-meta,
.cat-summary {
  color: var(--text-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-summary.muted {
  color: var(--text-disabled, #9ca3af);
}

@media (max-width: 760px) {
  .console-layout {
    grid-template-columns: 1fr;
    padding: 12px;
  }
}
</style>
