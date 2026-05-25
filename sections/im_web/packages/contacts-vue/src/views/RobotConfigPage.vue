<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useRobotConfigStore, type RobotConfig } from '../stores/robotConfigStore';

const router = useRouter();
const robotConfigStore = useRobotConfigStore();
const editingId = ref('');

const form = reactive({
  name: '',
  provider: 'openai-compatible',
  apiUrl: '',
  apiKey: '',
  model: '',
  prompt: '',
  enabled: true
});

const canSave = computed(() => {
  return form.name.trim().length > 0 && form.apiUrl.trim().length > 0 && form.model.trim().length > 0;
});

function resetForm() {
  editingId.value = '';
  form.name = '';
  form.provider = 'openai-compatible';
  form.apiUrl = '';
  form.apiKey = '';
  form.model = '';
  form.prompt = '';
  form.enabled = true;
}

function editConfig(config: RobotConfig) {
  editingId.value = config.id;
  form.name = config.name;
  form.provider = config.provider;
  form.apiUrl = config.apiUrl;
  form.apiKey = config.apiKey;
  form.model = config.model;
  form.prompt = config.prompt;
  form.enabled = config.enabled;
}

function saveConfig() {
  if (!canSave.value) return;
  robotConfigStore.upsertConfig({
    id: editingId.value || undefined,
    name: form.name,
    provider: form.provider,
    apiUrl: form.apiUrl,
    apiKey: form.apiKey,
    model: form.model,
    prompt: form.prompt,
    enabled: form.enabled
  });
  resetForm();
}

function back() {
  router.push('/chat');
}
</script>

<template>
  <div class="robot-config-page">
    <div class="page-header">
      <button class="icon-btn" title="返回" @click="back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h3>新增机器人</h3>
        <span>配置第三方 AI 接口，用于后续接入自动应答</span>
      </div>
    </div>

    <div class="config-layout">
      <section class="config-section">
        <div class="section-title">{{ editingId ? '编辑机器人' : '机器人设置' }}</div>
        <label class="field">
          <span>名称</span>
          <input v-model="form.name" placeholder="例如：客服助手" />
        </label>
        <label class="field">
          <span>接口类型</span>
          <select v-model="form.provider">
            <option value="openai-compatible">OpenAI 兼容接口</option>
            <option value="deepseek">DeepSeek</option>
            <option value="custom">自定义 HTTP 接口</option>
          </select>
        </label>
        <label class="field">
          <span>接口地址</span>
          <input v-model="form.apiUrl" placeholder="https://api.example.com/v1/chat/completions" />
        </label>
        <label class="field">
          <span>API Key</span>
          <input v-model="form.apiKey" type="password" placeholder="由第三方 AI 平台提供" />
        </label>
        <label class="field">
          <span>模型</span>
          <input v-model="form.model" placeholder="例如：gpt-4o-mini / deepseek-chat" />
        </label>
        <label class="field">
          <span>系统提示词</span>
          <textarea v-model="form.prompt" rows="4" placeholder="定义这个机器人应该如何回复"></textarea>
        </label>
        <label class="toggle-field">
          <input v-model="form.enabled" type="checkbox" />
          <span>启用这个机器人</span>
        </label>
        <div class="form-actions">
          <button class="secondary-btn" @click="resetForm">清空</button>
          <button class="primary-btn" :disabled="!canSave" @click="saveConfig">保存配置</button>
        </div>
      </section>

      <section class="config-section">
        <div class="section-title">已配置机器人</div>
        <div v-if="robotConfigStore.configs.length === 0" class="empty-state">
          暂无自定义机器人
        </div>
        <div v-else class="robot-list">
          <div v-for="item in robotConfigStore.configs" :key="item.id" class="robot-row">
            <div class="robot-main" @click="editConfig(item)">
              <span class="robot-name">{{ item.name }}</span>
              <span class="robot-meta">{{ item.provider }} · {{ item.model || '未设置模型' }}</span>
            </div>
            <label class="mini-toggle" title="启用">
              <input
                type="checkbox"
                :checked="item.enabled"
                @change="robotConfigStore.setEnabled(item.id, ($event.target as HTMLInputElement).checked)"
              />
            </label>
            <button class="icon-btn danger" title="删除" @click="robotConfigStore.removeConfig(item.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.robot-config-page {
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

.config-layout {
  display: grid;
  grid-template-columns: minmax(320px, 480px) minmax(280px, 1fr);
  gap: 20px;
  padding: 20px;
}

.config-section {
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  padding: 16px;
}

.section-title {
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
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

.toggle-field,
.mini-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 13px;
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

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  border: var(--border-hairline);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
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

.icon-btn.danger {
  color: #cf1322;
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

.robot-list {
  display: flex;
  flex-direction: column;
}

.robot-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  border-bottom: var(--border-hairline);
}

.robot-row:last-child {
  border-bottom: none;
}

.robot-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  cursor: pointer;
}

.robot-name {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.robot-meta {
  color: var(--text-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .config-layout {
    grid-template-columns: 1fr;
    padding: 12px;
  }
}
</style>
