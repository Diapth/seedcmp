<script setup lang="ts">
const props = withDefaults(defineProps<{
  visible: boolean;
  title: string;
  message?: string;
  mode?: 'confirm' | 'input';
  modelValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
}>(), {
  mode: 'confirm',
  message: '',
  modelValue: '',
  placeholder: '',
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
  loading: false
});

const emit = defineEmits<{
  close: [];
  cancel: [];
  confirm: [value?: string];
  'update:modelValue': [value: string];
}>();

function handleCancel() {
  emit('cancel');
  emit('close');
}

function handleConfirm() {
  emit('confirm', props.mode === 'input' ? props.modelValue : undefined);
}
</script>

<template>
  <div v-if="visible" class="app-dialog-mask" @click.self="handleCancel">
    <div class="app-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <div class="app-dialog-header">
        <h3 class="app-dialog-title">{{ title }}</h3>
        <button class="app-dialog-close" aria-label="关闭" @click="handleCancel">×</button>
      </div>
      <div class="app-dialog-body">
        <p v-if="message" class="app-dialog-message">{{ message }}</p>
        <textarea
          v-if="mode === 'input'"
          class="app-dialog-input"
          :value="modelValue"
          :placeholder="placeholder"
          rows="3"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>
      <div class="app-dialog-footer">
        <button class="app-dialog-btn secondary" :disabled="loading" @click="handleCancel">{{ cancelText }}</button>
        <button class="app-dialog-btn" :class="{ danger }" :disabled="loading" @click="handleConfirm">
          {{ loading ? '处理中...' : confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 3200;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.app-dialog {
  width: 420px;
  max-width: min(420px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 48px));
  overflow: auto;
  background-color: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
}

.app-dialog-header {
  min-height: 52px;
  padding: 0 16px;
  border-bottom: var(--border-hairline);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.app-dialog-title {
  margin: 0;
  font-size: 15px;
  color: var(--text-primary);
}

.app-dialog-close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
}

.app-dialog-body {
  padding: 16px;
}

.app-dialog-message {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.app-dialog-input {
  width: 100%;
  min-height: 84px;
  resize: vertical;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  padding: 10px;
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
}

.app-dialog-footer {
  padding: 12px 16px;
  border-top: var(--border-hairline);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.app-dialog-btn {
  min-width: 76px;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm);
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  cursor: pointer;
}

.app-dialog-btn.secondary {
  border: var(--border-hairline);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.app-dialog-btn.danger {
  background-color: #cf1322;
}

.app-dialog-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
