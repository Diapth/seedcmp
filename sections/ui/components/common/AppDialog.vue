<template>
  <Teleport to="body" v-if="isClient && visible">
    <view
      class="app-dialog-mask"
      :class="'variant-' + variant"
      @click.self="handleMaskClick"
      @touchmove.stop.prevent="noop"
    >
      <!-- Action Sheet: 列表式选项，点选即关闭 -->
      <view v-if="variant === 'action-sheet'" class="app-dialog-container glass-panel sheet-action" :class="'width-' + width">
        <scroll-view scroll-y class="sheet-action-list">
          <view
            v-for="(item, idx) in actionItems"
            :key="idx"
            class="sheet-action-item"
            :class="{ destructive: item.danger }"
            @click="handleActionItem(item)"
          >
            <text class="sheet-action-text">{{ item.label }}</text>
          </view>
        </scroll-view>
        <view class="sheet-action-cancel" @click="close">
          <text class="sheet-action-cancel-text">取消</text>
        </view>
      </view>

      <!-- Bottom Sheet: 圆角顶边，最高 80vh -->
      <view
        v-else-if="variant === 'bottom-sheet'"
        class="app-dialog-container glass-panel sheet-bottom"
        :class="'width-' + width"
      >
        <view v-if="$slots.header || title" class="dialog-header">
          <slot name="header">
            <view class="dialog-header-bar" v-if="title">
              <text class="dialog-title">{{ title }}</text>
            </view>
          </slot>
        </view>
        <scroll-view scroll-y class="dialog-body">
          <slot>
            <text class="dialog-content-text">{{ content }}</text>
          </slot>
        </scroll-view>
        <view v-if="$slots.footer || shouldShowFooter" class="dialog-footer">
          <slot name="footer">
            <button
              v-if="showCancel"
              class="dialog-btn btn-cancel"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>
            <button
              class="dialog-btn btn-confirm"
              :class="{ destructive: destructive }"
              :disabled="confirmDisabled || loading"
              @click="handleConfirm"
            >
              <view v-if="loading" class="btn-spinner" />
              <text v-else class="btn-text">{{ confirmText }}</text>
            </button>
          </slot>
        </view>
      </view>

      <!-- Popover: 居中浮层,可选位置 -->
      <view
        v-else-if="variant === 'popover'"
        class="app-dialog-container glass-panel popover"
        :class="'width-' + width"
        :style="popoverStyle"
      >
        <view v-if="$slots.header || title" class="dialog-header">
          <slot name="header">
            <text class="dialog-title">{{ title }}</text>
          </slot>
        </view>
        <view class="dialog-body">
          <slot>
            <text class="dialog-content-text">{{ content }}</text>
          </slot>
        </view>
        <view v-if="$slots.footer || shouldShowFooter" class="dialog-footer">
          <slot name="footer">
            <button
              v-if="showCancel"
              class="dialog-btn btn-cancel"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>
            <button
              class="dialog-btn btn-confirm"
              :class="{ destructive: destructive }"
              :disabled="confirmDisabled || loading"
              @click="handleConfirm"
            >
              <view v-if="loading" class="btn-spinner" />
              <text v-else class="btn-text">{{ confirmText }}</text>
            </button>
          </slot>
        </view>
      </view>

      <!-- Confirm (default) -->
      <view v-else class="app-dialog-container glass-panel confirm" :class="'width-' + width">
        <view v-if="$slots.header || title" class="dialog-header">
          <slot name="header">
            <text class="dialog-title">{{ title }}</text>
          </slot>
        </view>
        <view class="dialog-body">
          <slot>
            <text class="dialog-content-text">{{ content }}</text>
          </slot>
        </view>
        <view v-if="$slots.footer || shouldShowFooter" class="dialog-footer">
          <slot name="footer">
            <button
              v-if="showCancel"
              class="dialog-btn btn-cancel"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>
            <button
              class="dialog-btn btn-confirm"
              :class="{ destructive: destructive }"
              :disabled="confirmDisabled || loading"
              @click="handleConfirm"
            >
              <view v-if="loading" class="btn-spinner" />
              <text v-else class="btn-text">{{ confirmText }}</text>
            </button>
          </slot>
        </view>
      </view>
    </view>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  showCancel: { type: Boolean, default: true },
  // 新增
  variant: {
    type: String,
    default: 'confirm',
    validator: (v) => ['confirm', 'bottom-sheet', 'action-sheet', 'popover'].includes(v)
  },
  width: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'full'].includes(v)
  },
  destructive: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  confirmDisabled: { type: Boolean, default: false },
  showFooter: { type: Boolean, default: true },
  // 兼容旧字段
  closeOnMaskClick: { type: Boolean, default: true },
  maskClosable: { type: Boolean, default: true },
  // action-sheet 选项
  actionItems: { type: Array, default: () => [] },
  // popover 位置
  popoverX: { type: Number, default: 0 },
  popoverY: { type: Number, default: 0 }
});

const emit = defineEmits(['update:visible', 'confirm', 'cancel', 'action']);

const isClient = ref(false);
onMounted(() => { isClient.value = true; });

const shouldShowFooter = computed(() => {
  if (props.variant === 'action-sheet') return false;
  if (!props.showFooter) return false;
  if (props.variant === 'bottom-sheet') return true;
  return true;
});

const popoverStyle = computed(() => {
  return {
    top: `${props.popoverY}px`,
    left: `${props.popoverX}px`
  };
});

function noop() {}

function close() {
  emit('update:visible', false);
}

function handleMaskClick() {
  const closable = props.maskClosable !== undefined ? props.maskClosable : props.closeOnMaskClick;
  if (closable) close();
}

function handleConfirm() {
  if (props.loading || props.confirmDisabled) return;
  emit('confirm');
  // 显式语义: useConfirm 包装器会在 confirm 后调用 close; 通用情况下也建议 close
  if (props.variant !== 'popover') {
    // 默认 confirm 立即关闭, 调用方若需异步可在 confirm handler 中 preventDefault
    close();
  }
}

function handleCancel() {
  emit('cancel');
  close();
}

function handleActionItem(item) {
  emit('action', item);
  if (typeof item.onClick === 'function') item.onClick();
  close();
}
</script>

<style scoped>
.app-dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

/* confirm / popover 默认居中 */
.app-dialog-container.confirm,
.app-dialog-container.popover {
  width: 90%;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}
.app-dialog-container.popover {
  position: absolute;
}

.width-sm { max-width: 320px; }
.width-md { max-width: 400px; }
.width-lg { max-width: 520px; }
.width-full { max-width: 100%; }

/* bottom-sheet */
.app-dialog-mask.variant-bottom-sheet {
  align-items: flex-end;
  justify-content: center;
}
.app-dialog-container.sheet-bottom {
  width: 100%;
  max-width: 100%;
  max-height: 80vh;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* action-sheet */
.app-dialog-mask.variant-action-sheet {
  align-items: flex-end;
  justify-content: center;
}
.app-dialog-container.sheet-action {
  width: 100%;
  max-width: 100%;
  border-radius: 12px 12px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
}
.sheet-action-list {
  max-height: 60vh;
}
.sheet-action-item {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  background-color: var(--color-bg-surface);
}
.sheet-action-item:active {
  background-color: var(--color-bg-hover);
}
.sheet-action-item.destructive .sheet-action-text {
  color: var(--color-error);
}
.sheet-action-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.sheet-action-cancel {
  margin-top: 8px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: var(--color-bg-surface);
}
.sheet-action-cancel-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.dialog-header {
  padding: 20px 24px 10px;
}
.dialog-header-bar {
  text-align: center;
}
.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: block;
}
.dialog-body {
  padding: 16px 24px 24px;
}
.sheet-bottom .dialog-body {
  flex: 1;
  overflow-y: auto;
}
.dialog-content-text {
  font-size: 15px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.dialog-footer {
  display: flex;
  border-top: 1px solid var(--color-border);
}
.sheet-bottom .dialog-footer {
  flex-shrink: 0;
}
.dialog-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 14px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  cursor: pointer;
  gap: 6px;
}
.dialog-btn::after {
  border: none;
}
.btn-cancel {
  color: var(--color-text-secondary);
  border-right: 1px solid var(--color-border);
}
.btn-confirm {
  color: var(--color-primary);
  font-weight: 600;
}
.btn-confirm.destructive {
  color: var(--color-error);
}
.btn-confirm[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-text {
  font-size: 16px;
}
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: btn-spin 1s linear infinite;
}
@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
</style>
