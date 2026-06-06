<template>
  <AppSubpageShell>
    <view class="new-agent-page flex-column flex-1">
      <!-- Header -->
      <view class="page-header flex-row align-center justify-between">
        <view class="header-left flex-row align-center">
          <view class="back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
          <view class="title-stack flex-column">
            <text class="title">{{ pageTitle }}</text>
            <text class="subtitle">{{ pageSubtitle }}</text>
          </view>
        </view>
        <view class="header-right flex-row align-center">
          <button class="help-btn flex-row align-center gap-1" @click="openHelp">
            <AppIcon name="info" :size="14" color="var(--color-text-secondary)" />
            <text>查看帮助</text>
          </button>
        </view>
      </view>

      <scroll-view scroll-y class="form-scroll flex-1">
        <view class="layout-row">
          <!-- Left: Form -->
          <view class="form-column flex-column gap-4">
            <!-- 1. Basic Info -->
            <view class="form-card glass-panel flex-column gap-3">
              <view class="card-header flex-row align-center gap-2">
                <view class="card-icon">
                  <AppIcon name="user" :size="16" color="var(--color-primary)" />
                </view>
                <text class="card-title">基础信息</text>
              </view>

              <view class="form-grid">
                <view class="input-group flex-column gap-1">
                  <text class="input-label">智能体名称 <text class="required">*</text></text>
                  <input
                    type="text"
                    v-model="form.name"
                    placeholder="例如：QA 质量保证"
                    maxlength="40"
                    class="form-input"
                    placeholder-style="color: var(--color-text-muted)"
                    @input="onFormChange"
                  />
                  <text class="input-hint">{{ form.name.length }}/40</text>
                </view>

                <view class="input-group flex-column gap-1">
                  <text class="input-label">@ 别名</text>
                  <view class="alias-wrap flex-row align-center">
                    <text class="alias-prefix">@</text>
                    <input
                      type="text"
                      v-model="form.aliasRaw"
                      placeholder="QA"
                      maxlength="20"
                      class="form-input flex-1 alias-input"
                      placeholder-style="color: var(--color-text-muted)"
                      @input="onAliasInput"
                    />
                  </view>
                  <text class="input-hint">用于在会话中通过 @ 触发该智能体</text>
                </view>
              </view>

              <view class="input-group flex-column gap-1">
                <text class="input-label">一句话介绍</text>
                <textarea
                  v-model="form.desc"
                  placeholder="发布前再慌也保持冷静，负责自动化测试、回归验证与质量门禁。"
                  maxlength="200"
                  class="form-textarea"
                  placeholder-style="color: var(--color-text-muted)"
                  @input="onFormChange"
                />
                <text class="input-hint hint-right">{{ form.desc.length }}/200</text>
              </view>
            </view>

            <!-- 2. Role & Capabilities -->
            <view class="form-card glass-panel flex-column gap-3">
              <view class="card-header flex-row align-center gap-2">
                <view class="card-icon">
                  <AppIcon name="user" :size="16" color="var(--color-primary)" />
                </view>
                <text class="card-title">角色与能力</text>
              </view>

              <view class="input-group flex-column gap-1">
                <text class="input-label">角色模板</text>
                <picker @change="onRoleChange" :value="roleIndex" :range="roleTemplates" range-key="label" class="picker-trigger">
                  <view class="picker-value flex-row align-center justify-between">
                    <text>{{ currentRole.label }}</text>
                    <AppIcon name="chevron-down" :size="14" color="var(--color-text-secondary)" />
                  </view>
                </picker>
                <view class="role-tip flex-row gap-2">
                  <AppIcon name="info" :size="14" color="var(--color-primary)" />
                  <text class="role-tip-text">{{ currentRole.description }}</text>
                </view>
              </view>

              <view class="input-group flex-column gap-1">
                <text class="input-label">能力标签</text>
                <view class="tag-input-wrap flex-row align-center wrap">
                  <view
                    v-for="(tag, idx) in form.capabilityTags"
                    :key="tag + idx"
                    class="tag-chip flex-row align-center gap-1"
                  >
                    <text>{{ tag }}</text>
                    <view class="tag-remove" @click="removeTag(idx)">
                      <AppIcon name="close" :size="10" color="var(--color-text-secondary)" />
                    </view>
                  </view>
                  <input
                    type="text"
                    v-model="tagDraft"
                    placeholder="添加标签后按回车"
                    class="tag-input"
                    maxlength="12"
                    confirm-type="done"
                    placeholder-style="color: var(--color-text-muted)"
                    @confirm="addTag"
                    @blur="addTag"
                  />
                </view>
                <text class="input-hint">最多添加 8 个能力标签，便于在智能体库中检索</text>
              </view>
            </view>

            <!-- 3. Model Settings -->
            <view class="form-card glass-panel flex-column gap-3">
              <view class="card-header flex-row align-center gap-2">
                <view class="card-icon">
                  <AppIcon name="settings" :size="16" color="var(--color-primary)" />
                </view>
                <text class="card-title">模型设置</text>
              </view>

              <view class="form-grid">
                <view class="input-group flex-column gap-1">
                  <text class="input-label">运行平台</text>
                  <view class="segmented flex-row">
                    <view
                      v-for="p in platforms"
                      :key="p.value"
                      class="segmented-item flex-1 flex-row align-center justify-center"
                      :class="{ active: form.platform === p.value }"
                      @click="form.platform = p.value; onFormChange()"
                    >
                      <text>{{ p.label }}</text>
                    </view>
                  </view>
                </view>

                <view class="input-group flex-column gap-1">
                  <text class="input-label">接入方式</text>
                  <view class="segmented flex-row">
                    <view
                      v-for="m in accessModes"
                      :key="m.value"
                      class="segmented-item flex-1 flex-row align-center justify-center"
                      :class="{ active: form.accessMode === m.value }"
                      @click="form.accessMode = m.value; onFormChange()"
                    >
                      <text>{{ m.label }}</text>
                    </view>
                  </view>
                </view>
              </view>

              <view class="form-grid">
                <view class="input-group flex-column gap-1">
                  <text class="input-label">模型</text>
                  <picker @change="onModelChange" :value="modelIndex" :range="modelOptions" class="picker-trigger">
                    <view class="picker-value flex-row align-center justify-between">
                      <text>{{ modelOptions[modelIndex] }}</text>
                      <AppIcon name="chevron-down" :size="14" color="var(--color-text-secondary)" />
                    </view>
                  </picker>
                </view>

                <view class="input-group flex-column gap-1">
                  <text class="input-label">账号引用</text>
                  <input
                    type="text"
                    v-model="form.accountRef"
                    placeholder="openai-prod"
                    class="form-input"
                    placeholder-style="color: var(--color-text-muted)"
                    @input="onFormChange"
                  />
                </view>
              </view>

              <!-- API Key 专属配置 -->
              <view v-if="form.accessMode === 'api-key'" class="api-config-block flex-column gap-3">
                <view class="block-divider flex-row align-center gap-2">
                  <view class="divider-line" />
                  <text class="divider-text">API 接入配置</text>
                  <view class="divider-line" />
                </view>

                <view class="input-group flex-column gap-1">
                  <text class="input-label">API 密钥 <text class="required">*</text></text>
                  <view class="secret-wrap flex-row align-center">
                    <input
                      :type="showApiKey ? 'text' : 'password'"
                      v-model="form.apiKey"
                      placeholder="sk-xxxxxxxxxxxxxxxx"
                      class="form-input flex-1 secret-input"
                      placeholder-style="color: var(--color-text-muted)"
                      @input="onFormChange"
                    />
                    <view class="secret-toggle" @click="showApiKey = !showApiKey">
                      <AppIcon
                        :name="showApiKey ? 'eye-off' : 'eye'"
                        :size="16"
                        color="var(--color-text-secondary)"
                      />
                    </view>
                  </view>
                  <view class="security-tip flex-row align-center gap-1">
                    <AppIcon name="lock" :size="12" color="var(--color-text-muted)" />
                    <text class="input-hint">密钥将加密保存于本地，仅在调用模型时使用</text>
                  </view>
                </view>

                <view class="form-grid">
                  <view class="input-group flex-column gap-1">
                    <text class="input-label">API 接入地址 <text class="required">*</text></text>
                    <input
                      type="text"
                      v-model="form.apiUrl"
                      placeholder="https://api.openai.com/v1"
                      class="form-input"
                      placeholder-style="color: var(--color-text-muted)"
                      @input="onFormChange"
                    />
                    <text class="input-hint">兼容 OpenAI 协议的端点（Base URL）</text>
                  </view>

                  <view class="input-group flex-column gap-1">
                    <text class="input-label">自定义模型名</text>
                    <input
                      type="text"
                      v-model="form.customModel"
                      placeholder="例如：gpt-4o-mini-2024-07-18"
                      class="form-input"
                      placeholder-style="color: var(--color-text-muted)"
                      @input="onFormChange"
                    />
                    <text class="input-hint">留空则使用上方选择的模型</text>
                  </view>
                </view>
              </view>

              <!-- 模板选择（OAuth 模式也可使用） -->
              <view class="input-group flex-column gap-1">
                <view class="label-row flex-row align-center justify-between">
                  <text class="input-label">提示词模板</text>
                  <view class="link-btn" @click="showTemplateManager = true">
                    <text>管理模板</text>
                  </view>
                </view>
                <view class="template-grid flex-row">
                  <view
                    v-for="tpl in templateOptions"
                    :key="tpl.id"
                    class="template-card flex-column gap-1"
                    :class="{ active: form.templateId === tpl.id }"
                    @click="applyTemplate(tpl.id)"
                  >
                    <view class="template-head flex-row align-center gap-1">
                      <view class="template-dot" :class="tpl.tone" />
                      <text class="template-name">{{ tpl.name }}</text>
                    </view>
                    <text class="template-desc">{{ tpl.summary }}</text>
                  </view>
                </view>
                <text class="input-hint">选择一个模板以快速填充系统提示词，可继续编辑</text>
              </view>

              <view class="input-group flex-column gap-1">
                <view class="label-row flex-row align-center justify-between">
                  <text class="input-label">系统提示词</text>
                  <text class="counter-text">{{ form.systemPrompt.length }}/2000</text>
                </view>
                <textarea
                  v-model="form.systemPrompt"
                  placeholder="补充角色边界、输出格式或工具调用规则..."
                  maxlength="2000"
                  class="form-textarea tall"
                  placeholder-style="color: var(--color-text-muted)"
                  @input="onFormChange"
                />
                <view class="prompt-actions flex-row gap-2">
                  <view class="action-pill" @click="appendPromptSnippet('cot')">
                    <AppIcon name="info" :size="12" color="var(--color-primary)" />
                    <text>插入思维链</text>
                  </view>
                  <view class="action-pill" @click="appendPromptSnippet('json')">
                    <AppIcon name="code" :size="12" color="var(--color-primary)" />
                    <text>JSON 输出</text>
                  </view>
                  <view class="action-pill" @click="appendPromptSnippet('tools')">
                    <AppIcon name="settings" :size="12" color="var(--color-primary)" />
                    <text>工具调用</text>
                  </view>
                </view>
              </view>
            </view>

            <!-- Mobile action bar (only on mobile) -->
            <view class="mobile-action-bar" v-if="!isDesktop">
              <button class="btn-clear" @click="handleClear">{{ resetActionText }}</button>
              <button
                class="btn-submit"
                :disabled="!canSubmit"
                :loading="submitting"
                @click="handleCreate"
              >{{ submitText }}</button>
            </view>
          </view>

          <!-- Right: Preview + Check (sticky on desktop) -->
          <view class="preview-column flex-column gap-3" v-if="isDesktop">
            <!-- Preview Card -->
            <view class="preview-card glass-panel flex-column gap-3">
              <view class="card-header flex-row align-center gap-2">
                <view class="card-icon">
                  <AppIcon name="eye" :size="16" color="var(--color-primary)" />
                </view>
                <text class="card-title">{{ previewTitle }}</text>
              </view>

              <view class="preview-body flex-row gap-3">
                <view class="preview-avatar">
                  <AppAvatar :text="form.name || 'QA'" :size="64" :is-circle="false" />
                </view>
                <view class="preview-meta flex-column gap-1 flex-1">
                  <view class="preview-name-row flex-row align-center gap-2">
                    <text class="preview-name">{{ form.name || '智能体名称' }}</text>
                    <view class="badge-tone">{{ currentPlatform.label }}</view>
                    <view class="badge-blue">{{ previewStateText }}</view>
                  </view>
                  <text class="preview-alias">@{{ form.aliasRaw || 'alias' }}</text>
                  <text class="preview-desc">{{ form.desc || '简要介绍此智能体的能力与适用场景' }}</text>
                </view>
              </view>

              <view class="preview-tags" v-if="form.capabilityTags.length > 0">
                <view v-for="(tag, i) in form.capabilityTags" :key="i" class="preview-tag">
                  <text>{{ tag }}</text>
                </view>
              </view>
            </view>

            <!-- Pre-deployment check -->
            <view class="check-card glass-panel flex-column gap-2">
              <view class="card-header flex-row align-center gap-2">
                <view class="card-icon">
                  <AppIcon name="shield" :size="16" color="var(--color-primary)" />
                </view>
                <text class="card-title">{{ checkTitle }}</text>
              </view>
              <view
                v-for="item in checkList"
                :key="item.key"
                class="check-item flex-row align-center gap-2"
                :class="{ ok: item.passed, fail: !item.passed }"
              >
                <view class="check-icon">
                  <AppIcon
                    :name="item.passed ? 'check' : 'info'"
                    :size="14"
                    :color="item.passed ? 'var(--color-success)' : 'var(--color-text-muted)'"
                  />
                </view>
                <text class="check-text">{{ item.label }}</text>
              </view>
            </view>

            <!-- Action buttons -->
            <view class="action-bar flex-row gap-2">
              <button class="btn-clear" @click="handleClear">{{ resetActionText }}</button>
              <button
                class="btn-submit flex-1"
                :disabled="!canSubmit"
                :loading="submitting"
                @click="handleCreate"
              >{{ submitText }}</button>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- Help dialog -->
      <AppDialog
        :visible="helpVisible"
        :title="helpTitle"
        :show-cancel="false"
        confirm-text="我知道了"
        @update:visible="helpVisible = $event"
        @confirm="helpVisible = false"
      >
        <view class="help-content flex-column gap-2">
          <text class="help-line">• 智能体可被 @ 触发并加入会话或群聊</text>
          <text class="help-line">• 角色模板会自动注入对应的系统提示词</text>
          <text class="help-line">• 能力标签会用于在智能体库中检索</text>
          <text class="help-line">• 保存前会校验必填字段、模型可用性与标签同步</text>
        </view>
      </AppDialog>

      <!-- 模板管理弹窗 -->
      <AppDialog
        v-if="showTemplateManager"
        :visible="showTemplateManager"
        title="管理提示词模板"
        :show-cancel="false"
        confirm-text="完成"
        width="lg"
        @update:visible="showTemplateManager = $event"
        @confirm="showTemplateManager = false"
      >
        <view class="tpl-manager flex-column gap-3">
          <view class="tpl-list flex-column gap-2">
            <view
              v-for="tpl in templateOptions"
              :key="tpl.id"
              class="tpl-row flex-row align-center justify-between"
            >
              <view class="tpl-row-meta flex-row align-center gap-2 flex-1">
                <view class="template-dot" :class="tpl.tone" />
                <view class="flex-column flex-1">
                  <text class="tpl-row-name">{{ tpl.name }}</text>
                  <text class="tpl-row-desc">{{ tpl.summary }}</text>
                </view>
              </view>
              <view class="tpl-row-actions flex-row align-center gap-2">
                <view class="mini-btn" @click="previewTemplate(tpl)">
                  <text>预览</text>
                </view>
                <view class="mini-btn" v-if="tpl.id !== 'blank' && tpl.id !== 'blank-reviewer'" @click="deleteTemplate(tpl.id)">
                  <text class="danger">删除</text>
                </view>
              </view>
            </view>
          </view>

          <view class="tpl-create flex-column gap-2">
            <text class="tpl-section-title">新建自定义模板</text>
            <view class="form-grid">
              <view class="input-group flex-column gap-1">
                <text class="input-label">模板名称</text>
                <input
                  v-model="newTpl.name"
                  type="text"
                  placeholder="例如：产品需求拆解"
                  class="form-input"
                  placeholder-style="color: var(--color-text-muted)"
                />
              </view>
              <view class="input-group flex-column gap-1">
                <text class="input-label">一句话说明</text>
                <input
                  v-model="newTpl.summary"
                  type="text"
                  placeholder="用一句话描述模板用途"
                  class="form-input"
                  placeholder-style="color: var(--color-text-muted)"
                />
              </view>
            </view>
            <view class="input-group flex-column gap-1">
              <text class="input-label">提示词内容</text>
              <textarea
                v-model="newTpl.body"
                placeholder="输入模板正文，可使用 {{agent_name}}、{{alias}} 等占位符"
                class="form-textarea"
                placeholder-style="color: var(--color-text-muted)"
              />
            </view>
            <view class="tpl-create-actions flex-row gap-2">
              <button class="btn-secondary" @click="resetNewTemplate">重置</button>
              <button class="btn-primary" @click="saveNewTemplate">保存模板</button>
            </view>
          </view>
        </view>
      </AppDialog>

      <!-- 模板预览弹窗 -->
      <AppDialog
        v-if="previewTpl"
        :visible="!!previewTpl"
        :title="'预览：' + previewTpl.name"
        :show-cancel="false"
        confirm-text="关闭"
        width="md"
        @update:visible="previewTpl = null"
        @confirm="previewTpl = null"
      >
        <view class="tpl-preview flex-column gap-2">
          <text class="tpl-row-desc">{{ previewTpl.summary }}</text>
          <view class="tpl-preview-body">
            <text>{{ renderTemplate(previewTpl.body) }}</text>
          </view>
        </view>
      </AppDialog>
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useAgentStore } from '@/stores/agent';
import { useConversationStore } from '@/stores/conversation';
import { useNavigationStore } from '@/stores/navigation';
import { useResponsiveLayout } from '@/composables/useResponsiveLayout';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppDialog from '@/components/common/AppDialog.vue';

const agentStore = useAgentStore();
const convStore = useConversationStore();
const navStore = useNavigationStore();
const { isDesktop } = useResponsiveLayout();

onMounted(() => {
  navStore.setActiveModule('agents');
  loadEditingAgent();
});

function createDefaultForm() {
  return {
    name: '',
    aliasRaw: '',
    desc: '',
    roleTemplate: 'reviewer',
    capabilityTags: ['自动化测试', '回归验证', '质量门禁', '测试策略'],
    platform: 'codex',
    accessMode: 'api-key',
    model: 'DeepSeek V3',
    accountRef: 'openai-prod',
    apiKey: '',
    apiUrl: '',
    customModel: '',
    templateId: 'reviewer',
    systemPrompt: ''
  };
}

const editingAgentId = ref('');
const form = ref(createDefaultForm());

const tagDraft = ref('');
const submitting = ref(false);
const helpVisible = ref(false);
const showApiKey = ref(false);
const showTemplateManager = ref(false);
const previewTpl = ref(null);
const newTpl = ref({ name: '', summary: '', body: '' });
const customTemplates = ref([
  {
    id: 'tpl-custom-product',
    name: '产品需求拆解',
    summary: '将模糊需求拆解为可执行任务清单',
    tone: 'purple',
    body: '你是一位资深产品经理，名为 {{agent_name}}（@{{alias}}）。请将用户的需求拆解为：\n1. 目标用户与核心场景\n2. 功能清单（按优先级）\n3. 验收标准\n4. 潜在风险与依赖'
  }
]);

const roleTemplates = [
  { value: 'general', label: '通用助手', description: '通用助手：知识问答、写作润色、信息整理，适用于日常协作。' },
  { value: 'reviewer', label: '续闺猫（审查官）', description: '严谨认真，注重细节，会直言不讳地指出问题。' },
  { value: 'engineer', label: '工程师', description: '专注代码生成、重构与单元测试，适合敏捷开发协作。' },
  { value: 'analyst', label: '分析师', description: '擅长需求拆解、问题澄清与逻辑推演，适合复杂决策。' },
  { value: 'creative', label: '创意伙伴', description: '头脑风暴、灵感激发与方案发散，适合产品构思阶段。' },
  { value: 'coordinator', label: '多智能体协调', description: '负责聚合多个智能体的输出，组织团队协作。' }
];

const platforms = [
  { value: 'codex', label: 'Codex' },
  { value: 'claude-code', label: 'Claude Code' }
];

const accessModes = [
  { value: 'api-key', label: 'API Key' },
  { value: 'oauth', label: 'OAuth' }
];

const models = ['DeepSeek V3', 'DeepSeek R1', 'GPT-4o', 'Claude 3.5 Sonnet', 'Claude 3 Opus', '自定义'];

const presetTemplates = [
  {
    id: 'reviewer',
    name: '代码审查官',
    summary: '严谨指出问题，给出可执行的修复建议',
    tone: 'orange',
    body: '你是一位名为 {{agent_name}}（@{{alias}}）的代码审查官。职责：\n1. 仔细阅读用户的代码片段，逐行审视潜在风险\n2. 指出可能的回归、性能或安全问题，并解释原因\n3. 提供具体可执行的修复建议与最小化改动\n4. 始终保持冷静、专业的语气，必要时直接说"不推荐"'
  },
  {
    id: 'engineer',
    name: '全栈工程师',
    summary: '聚焦代码生成、重构与单元测试',
    tone: 'cyan',
    body: '你是一位名为 {{agent_name}}（@{{alias}}）的全栈工程师。请基于用户的描述，输出可运行的代码与必要的上下文。优先考虑：\n- 可读性 > 巧妙性\n- 必要的错误处理\n- 与已有风格保持一致\n完成后给出可一键运行的示例。'
  },
  {
    id: 'analyst',
    name: '业务分析师',
    summary: '拆解需求、澄清问题、辅助决策',
    tone: 'purple',
    body: '你是一位名为 {{agent_name}}（@{{alias}}）的业务分析师。面对用户的问题时，请：\n1. 主动澄清模糊点，给出结构化追问\n2. 将复杂问题拆解为子问题并按优先级排序\n3. 给出可量化的判断依据，而非泛泛之谈'
  },
  {
    id: 'creative',
    name: '创意伙伴',
    summary: '头脑风暴、灵感发散、命名建议',
    tone: 'green',
    body: '你是一位名为 {{agent_name}}（@{{alias}}）的创意伙伴。鼓励大胆发散，输出三个不同方向的方案，并标注每个方案的适用场景与潜在风险。'
  }
];

const roleToTemplateId = {
  general: 'reviewer',
  reviewer: 'reviewer',
  engineer: 'engineer',
  analyst: 'analyst',
  creative: 'creative',
  coordinator: 'reviewer'
};

const templateOptions = computed(() => [
  ...presetTemplates,
  ...customTemplates.value
]);

const modelOptions = computed(() => models);

const roleIndex = ref(0);
const modelIndex = ref(0);

const editingAgent = computed(() => {
  if (!editingAgentId.value) return null;
  return agentStore.agents.find(agent => agent.id === editingAgentId.value) || null;
});

const isEditing = computed(() => !!editingAgent.value);

const pageTitle = computed(() => (isEditing.value ? '智能体配置' : '新建智能体'));
const pageSubtitle = computed(() => (
  isEditing.value
    ? '查看并修改智能体基础信息、模型接入与系统提示词'
    : '创建可在会话、群聊与 @ 路由中使用的智能体联系人'
));
const previewTitle = computed(() => (isEditing.value ? '配置预览' : '创建预览'));
const previewStateText = computed(() => (isEditing.value ? '已部署' : '待部署'));
const checkTitle = computed(() => (isEditing.value ? '保存前检查' : '部署前检查'));
const resetActionText = computed(() => (isEditing.value ? '还原' : '清空'));
const submitText = computed(() => (isEditing.value ? '保存配置' : '创建并部署'));
const helpTitle = computed(() => (isEditing.value ? '智能体配置帮助' : '创建智能体帮助'));

const currentRole = computed(() => {
  return roleTemplates.find(r => r.value === form.value.roleTemplate) || roleTemplates[0];
});

const currentPlatform = computed(() => {
  return platforms.find(p => p.value === form.value.platform) || platforms[0];
});

const effectiveModel = computed(() => {
  if (form.value.accessMode === 'api-key' && form.value.customModel.trim()) {
    return form.value.customModel.trim();
  }
  return form.value.model;
});

const checkList = computed(() => [
  { key: 'name', label: '基础信息已填写', passed: !!form.value.name.trim() },
  { key: 'role', label: '角色模板已选择', passed: !!form.value.roleTemplate },
  { key: 'model', label: '模型账号可用', passed: !!form.value.accountRef.trim() && !!effectiveModel.value },
  { key: 'tags', label: '能力标签已同步', passed: form.value.capabilityTags.length > 0 },
  { key: 'api', label: 'API 配置完整', passed: form.value.accessMode !== 'api-key' || ((isEditing.value || !!form.value.apiKey.trim()) && !!form.value.apiUrl.trim()) }
]);

const canSubmit = computed(() => {
  return checkList.value.every(c => c.passed);
});

function onFormChange() {}

function loadEditingAgent() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const id = currentPage?.$page?.options?.id;
  if (!id) {
    syncSelectorIndexes();
    return;
  }

  const decodedId = decodeURIComponent(id);
  const agent = agentStore.agents.find(item => item.id === decodedId);
  if (!agent) {
    uni.showToast({ title: '未找到智能体配置', icon: 'none' });
    syncSelectorIndexes();
    return;
  }

  editingAgentId.value = decodedId;
  hydrateFormFromAgent(agent);
}

function hydrateFormFromAgent(agent) {
  const modelExists = models.includes(agent.model);
  form.value = {
    name: agent.name || '',
    aliasRaw: (agent.alias || '').replace(/^@/, ''),
    desc: agent.desc || '',
    roleTemplate: agent.roleTemplate || 'general',
    capabilityTags: [...(agent.capabilityTags || [])],
    platform: agent.platform || 'codex',
    accessMode: agent.accessMode || 'api-key',
    model: modelExists ? agent.model : '自定义',
    accountRef: agent.accountRef || '',
    apiKey: agent.apiKey || '',
    apiUrl: agent.apiUrl || '',
    customModel: agent.customModel || (modelExists ? '' : agent.model || ''),
    templateId: agent.templateId || roleToTemplateId[agent.roleTemplate] || 'reviewer',
    systemPrompt: agent.systemPrompt || ''
  };
  tagDraft.value = '';
  showApiKey.value = false;
  syncSelectorIndexes();
}

function syncSelectorIndexes() {
  const nextRoleIndex = roleTemplates.findIndex(role => role.value === form.value.roleTemplate);
  roleIndex.value = nextRoleIndex >= 0 ? nextRoleIndex : 0;

  const nextModelIndex = models.findIndex(model => model === form.value.model);
  modelIndex.value = nextModelIndex >= 0 ? nextModelIndex : 0;
}

function onAliasInput(e) {
  const val = (e?.detail?.value || form.value.aliasRaw).replace(/[^a-zA-Z0-9_一-龥]/g, '');
  form.value.aliasRaw = val.toLowerCase();
}

function onRoleChange(e) {
  const idx = e.detail.value;
  roleIndex.value = idx;
  const role = roleTemplates[idx];
  form.value.roleTemplate = role.value;
  const autoTplId = roleToTemplateId[role.value] || 'reviewer';
  if (form.value.templateId !== 'tpl-custom-product' && !form.value.templateId?.startsWith('tpl-custom-')) {
    form.value.templateId = autoTplId;
    const tpl = templateOptions.value.find(t => t.id === autoTplId);
    if (tpl) form.value.systemPrompt = renderTemplate(tpl.body);
  }
}

function onModelChange(e) {
  const idx = e.detail.value;
  modelIndex.value = idx;
  form.value.model = models[idx];
}

function applyTemplate(id) {
  form.value.templateId = id;
  const tpl = templateOptions.value.find(t => t.id === id);
  if (tpl) {
    form.value.systemPrompt = renderTemplate(tpl.body);
  }
}

function renderTemplate(body) {
  if (!body) return '';
  return body
    .replace(/{{agent_name}}/g, form.value.name.trim() || '智能体')
    .replace(/{{alias}}/g, form.value.aliasRaw.trim() || 'alias')
    .replace(/{{model}}/g, effectiveModel.value || 'model')
    .replace(/{{role}}/g, currentRole.value.label);
}

function appendPromptSnippet(kind) {
  const snippets = {
    cot: '\n\n## 思考方式\n在回答前请先分步骤梳理推理过程，最后再给出结论。',
    json: '\n\n## 输出格式\n请以 JSON 输出，结构：{"answer": "...", "reasoning": "...", "confidence": 0~1}',
    tools: '\n\n## 工具调用\n当用户要求执行具体操作时，调用合适的工具并按以下格式返回：{"tool": "工具名", "args": {...}}'
  };
  const cur = form.value.systemPrompt || '';
  form.value.systemPrompt = cur + (snippets[kind] || '');
}

function addTag() {
  const v = tagDraft.value.trim();
  if (!v) return;
  if (form.value.capabilityTags.length >= 8) {
    uni.showToast({ title: '最多 8 个标签', icon: 'none' });
    return;
  }
  if (form.value.capabilityTags.includes(v)) {
    tagDraft.value = '';
    return;
  }
  form.value.capabilityTags.push(v);
  tagDraft.value = '';
}

function removeTag(idx) {
  form.value.capabilityTags.splice(idx, 1);
}

function previewTemplate(tpl) {
  previewTpl.value = tpl;
}

function deleteTemplate(id) {
  uni.showModal({
    title: '删除模板',
    content: '确定删除该自定义模板？',
    success: (res) => {
      if (!res.confirm) return;
      customTemplates.value = customTemplates.value.filter(t => t.id !== id);
      if (form.value.templateId === id) form.value.templateId = 'reviewer';
      uni.showToast({ title: '已删除', icon: 'none' });
    }
  });
}

function resetNewTemplate() {
  newTpl.value = { name: '', summary: '', body: '' };
}

function saveNewTemplate() {
  const t = newTpl.value;
  if (!t.name.trim() || !t.body.trim()) {
    uni.showToast({ title: '请填写名称与内容', icon: 'none' });
    return;
  }
  const id = 'tpl-custom-' + Date.now();
  customTemplates.value.push({
    id,
    name: t.name.trim(),
    summary: t.summary.trim() || '用户自定义模板',
    tone: 'primary',
    body: t.body
  });
  form.value.templateId = id;
  form.value.systemPrompt = renderTemplate(t.body);
  resetNewTemplate();
  uni.showToast({ title: '模板已保存', icon: 'success' });
}

function goBack() {
  uni.navigateBack();
}

function openHelp() {
  helpVisible.value = true;
}

function handleClear() {
  const title = isEditing.value ? '还原配置' : '清空确认';
  const content = isEditing.value
    ? '将恢复为当前已保存的智能体配置，是否继续？'
    : '将清空当前已填写的内容，是否继续？';
  uni.showModal({
    title,
    content,
    success: (res) => {
      if (!res.confirm) return;
      if (isEditing.value && editingAgent.value) {
        hydrateFormFromAgent(editingAgent.value);
        uni.showToast({ title: '已还原', icon: 'none' });
        return;
      }
      form.value = {
        ...createDefaultForm(),
        roleTemplate: 'general',
        capabilityTags: []
      };
      tagDraft.value = '';
      showApiKey.value = false;
      syncSelectorIndexes();
      uni.showToast({ title: '已清空', icon: 'none' });
    }
  });
}

function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return '••••••••';
  return k.slice(0, 4) + '••••••••' + k.slice(-4);
}

function buildAgentPayload() {
  return {
    name: form.value.name.trim(),
    alias: '@' + form.value.aliasRaw.trim(),
    desc: form.value.desc.trim() || '由用户创建的智能体',
    avatar: editingAgent.value?.avatar || '',
    platform: form.value.platform,
    accessMode: form.value.accessMode,
    model: effectiveModel.value,
    accountRef: form.value.accountRef.trim(),
    apiKey: form.value.accessMode === 'api-key' ? maskKey(form.value.apiKey) : '',
    apiUrl: form.value.apiUrl.trim(),
    customModel: form.value.customModel.trim(),
    systemPrompt: form.value.systemPrompt,
    roleTemplate: form.value.roleTemplate,
    templateId: form.value.templateId,
    capabilityTags: [...form.value.capabilityTags]
  };
}

function syncAgentConversation(agentId, payload) {
  const conv = convStore.conversations.find(item => item.id === agentId);
  if (!conv) return;
  conv.name = payload.name;
  conv.avatar = payload.avatar || conv.avatar;
  conv.lastMessage = payload.desc;
}

function leaveConfigPage(fallbackUrl = '/pages/agents/index') {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
    return;
  }
  uni.redirectTo({ url: fallbackUrl });
}

async function handleCreate() {
  if (!canSubmit.value) {
    uni.showToast({ title: '请完成所有检查项', icon: 'none' });
    return;
  }
  submitting.value = true;

  const payload = buildAgentPayload();
  try {
    if (isEditing.value) {
      uni.showToast({ title: '智能体编辑接口待接入', icon: 'none' });
      return;
    }

    const agent = await agentStore.createAgent(payload);
    if (agent?.id) syncAgentConversation(agent.id, payload);
    submitting.value = false;
    uni.showToast({ title: '智能体已部署', icon: 'success' });
    uni.redirectTo({ url: '/pages/agents/index' });
  } catch (err) {
    uni.showToast({ title: err?.message || '智能体创建失败', icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.new-agent-page {
  height: 100%;
  background-color: var(--color-bg-base);
  background-image:
    radial-gradient(circle at 20% 0%, rgba(0, 74, 198, 0.06), transparent 40%),
    radial-gradient(circle at 100% 80%, rgba(16, 185, 129, 0.05), transparent 35%);
}

.page-header {
  min-height: 64px;
  padding: 0 24px;
  background-color: var(--color-glass-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
}

.header-left {
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.back-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  background-color: var(--color-bg-muted);
  transition: background-color 0.18s ease;
}
.back-btn:hover { background-color: var(--color-bg-hover); }

.title-stack {
  min-width: 0;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.25;
}

.subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.help-btn {
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.help-btn::after { border: none; }
.help-btn:hover { color: var(--color-text-primary); border-color: var(--color-border-hover); }

.form-scroll { height: 100%; }

.layout-row {
  display: flex;
  flex-direction: row;
  gap: 20px;
  padding: 20px 24px 32px;
  max-width: 1280px;
  margin: 0 auto;
  align-items: flex-start;
  box-sizing: border-box;
}

.form-column { flex: 1; min-width: 0; }
.preview-column { width: 340px; flex-shrink: 0; position: sticky; top: 20px; }

.gap-4 { gap: 16px; display: flex; }
.gap-3 { gap: 12px; display: flex; }
.gap-2 { gap: 8px; display: flex; }
.gap-1 { gap: 4px; display: flex; }

.form-card {
  padding: 20px;
  border-radius: 16px;
  display: flex;
}

.card-header { margin-bottom: 4px; }
.card-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background-color: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.input-group { display: flex; }
.input-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.required { color: var(--color-error); }
.input-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 4px;
}
.hint-right { text-align: right; }

.form-input {
  height: 40px;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 74, 198, 0.12);
}

.form-textarea {
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  width: 100%;
  height: 70px;
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.form-textarea.tall { height: 120px; }
.form-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 74, 198, 0.12);
}

.alias-wrap {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg-base);
  padding-left: 12px;
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.alias-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 74, 198, 0.12);
}
.alias-prefix {
  font-size: 14px;
  color: var(--color-text-muted);
  font-weight: 600;
  margin-right: 4px;
}
.alias-input {
  border: none;
  background: transparent;
  box-shadow: none;
  padding-left: 0;
}
.alias-input:focus { box-shadow: none; border: none; }

.picker-trigger { width: 100%; }
.picker-value {
  height: 40px;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  box-sizing: border-box;
  display: flex;
}

.role-tip {
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background-color: rgba(0, 74, 198, 0.06);
  border: 1px solid rgba(0, 74, 198, 0.12);
  align-items: flex-start;
}
.role-tip-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  flex: 1;
}

.tag-input-wrap {
  min-height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg-base);
  padding: 6px 8px;
  box-sizing: border-box;
  gap: 6px;
  flex-wrap: wrap;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.tag-input-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 74, 198, 0.12);
}
.wrap { flex-wrap: wrap; }

.tag-chip {
  height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
}
.tag-remove {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: rgba(0, 74, 198, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tag-input {
  flex: 1;
  min-width: 120px;
  height: 28px;
  font-size: 13px;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  padding: 0 4px;
}
.tag-input:focus { border: none; box-shadow: none; }

.segmented {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-bg-base);
  display: flex;
}
.segmented-item {
  height: 36px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}
.segmented-item + .segmented-item { border-left: 1px solid var(--color-border); }
.segmented-item.active {
  background-color: var(--color-primary);
  color: #ffffff;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.counter-text {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* Preview card */
.preview-card { padding: 20px; border-radius: 16px; display: flex; }
.preview-body { display: flex; }
.preview-avatar {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  flex-shrink: 0;
}
.preview-meta { min-width: 0; }
.preview-name-row { display: flex; }
.preview-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
.badge-tone {
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  background-color: rgba(16, 185, 129, 0.12);
  color: #10b981;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}
.badge-blue {
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}
.preview-alias {
  font-size: 12px;
  color: var(--color-text-muted);
}
.preview-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin-top: 2px;
}
.preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.preview-tag {
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  background-color: var(--color-bg-muted);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
}

/* Pre-deployment check */
.check-card { padding: 18px 20px; border-radius: 16px; display: flex; }
.check-item {
  display: flex;
  align-items: center;
  padding: 6px 0;
}
.check-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.check-item.ok .check-icon { background-color: rgba(16, 185, 129, 0.12); }
.check-item.fail .check-icon { background-color: var(--color-bg-muted); }
.check-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
}
.check-item.ok .check-text { color: var(--color-text-primary); }

/* Action bar */
.action-bar { display: flex; }
.btn-clear {
  height: 42px;
  padding: 0 18px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-clear::after { border: none; }
.btn-clear:hover { color: var(--color-text-primary); border-color: var(--color-border-hover); }

.btn-submit {
  height: 42px;
  background-color: var(--color-primary);
  color: #ffffff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0, 74, 198, 0.18);
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}
.btn-submit::after { border: none; }
.btn-submit:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  box-shadow: 0 4px 12px rgba(0, 74, 198, 0.22);
}
.btn-submit:disabled {
  background-color: var(--color-bg-muted);
  color: var(--color-text-muted);
  cursor: not-allowed;
  box-shadow: none;
}

/* Mobile action bar */
.mobile-action-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 10px;
  padding: 12px 0 16px;
  background: linear-gradient(180deg, transparent, var(--color-bg-base) 30%);
  margin-top: 4px;
}
.mobile-action-bar .btn-clear { flex: 0 0 96px; }
.mobile-action-bar .btn-submit { flex: 1; }

/* Help dialog */
.help-content { display: flex; padding: 4px 0; }
.help-line {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

/* API Key 配置块 */
.api-config-block {
  margin-top: 4px;
  padding: 14px;
  border-radius: 12px;
  background-color: rgba(0, 74, 198, 0.04);
  border: 1px dashed rgba(0, 74, 198, 0.24);
}

.block-divider { display: flex; }
.divider-line {
  flex: 1;
  height: 1px;
  background-color: var(--color-border);
}
.divider-text {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.5px;
}

.secret-wrap {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg-base);
  padding-right: 4px;
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.secret-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 74, 198, 0.12);
}
.secret-input {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding-right: 8px;
}
.secret-input:focus { box-shadow: none !important; border: none !important; }
.secret-toggle {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  flex-shrink: 0;
  transition: background-color 0.18s ease;
}
.secret-toggle:hover { background-color: var(--color-bg-hover); }

.security-tip {
  display: flex;
  align-items: center;
  margin-top: 4px;
}

/* 模板选择 */
.template-grid {
  gap: 8px;
  flex-wrap: wrap;
}
.template-card {
  flex: 1 1 180px;
  min-width: 160px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-base);
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}
.template-card:hover {
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
}
.template-card.active {
  border-color: var(--color-primary);
  background-color: var(--color-primary-light);
}
.template-head { display: flex; }
.template-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.template-dot.orange { background-color: #f97316; }
.template-dot.cyan { background-color: #06b6d4; }
.template-dot.purple { background-color: #8b5cf6; }
.template-dot.green { background-color: #10b981; }
.template-dot.primary { background-color: var(--color-primary); }

.template-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.template-desc {
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.link-btn {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
  padding: 2px 4px;
}
.link-btn:hover { text-decoration: underline; }

/* 提示词快捷片段 */
.prompt-actions {
  display: flex;
  margin-top: 4px;
}
.action-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  background-color: var(--color-bg-muted);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  border: 1px solid transparent;
  transition: border-color 0.18s ease, color 0.18s ease, background-color 0.18s ease;
}
.action-pill:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

/* 模板管理弹窗 */
.tpl-manager { display: flex; max-height: 70vh; }
.tpl-list { display: flex; }
.tpl-row {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background-color: var(--color-bg-base);
  display: flex;
}
.tpl-row-meta { display: flex; min-width: 0; }
.tpl-row-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.tpl-row-desc {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}
.tpl-row-actions { display: flex; flex-shrink: 0; }
.mini-btn {
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  background-color: var(--color-bg-muted);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  cursor: pointer;
}
.mini-btn:hover { background-color: var(--color-bg-hover); }
.mini-btn .danger { color: var(--color-error); }

.tpl-create {
  padding: 12px;
  border-radius: 10px;
  background-color: rgba(0, 74, 198, 0.04);
  display: flex;
}
.tpl-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
}
.tpl-create-actions { display: flex; }
.btn-secondary {
  flex: 0 0 80px;
  height: 38px;
  border-radius: 8px;
  background-color: var(--color-bg-base);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  font-size: 13px;
  font-weight: 600;
}
.btn-secondary::after { border: none; }
.btn-primary {
  flex: 1;
  height: 38px;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: #ffffff;
  border: none;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 74, 198, 0.18);
}
.btn-primary::after { border: none; }

/* 模板预览 */
.tpl-preview { display: flex; }
.tpl-preview-body {
  padding: 12px;
  border-radius: 8px;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow-y: auto;
}

/* Responsive */
@media (max-width: 1100px) {
  .layout-row {
    flex-direction: column;
    padding: 16px 16px 24px;
  }
  .preview-column {
    width: 100%;
    position: static;
  }
}

@media (max-width: 768px) {
  .page-header { padding: 0 16px; }
  .title { font-size: 16px; }
  .subtitle { display: none; }
  .help-btn span, .help-btn text { display: none; }
  .help-btn { width: 36px; padding: 0; }
  .form-grid { grid-template-columns: 1fr; }
  .form-card { padding: 16px; }
  .preview-card, .check-card { padding: 16px; }
}
</style>
