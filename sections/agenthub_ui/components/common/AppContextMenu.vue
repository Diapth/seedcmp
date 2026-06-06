<template>
  <!-- 桌面: 浮动绝对定位菜单 -->
  <view
    v-if="visible && isDesktop"
    class="ctx-mask"
    @click="emit('update:visible', false)"
    @touchmove.stop.prevent="noop"
  >
    <view
      class="ctx-menu glass-panel"
      :style="{ top: yPx, left: xPx }"
    >
      <template v-for="(item, idx) in items" :key="idx">
        <view
          v-if="item.divider"
          class="ctx-divider"
        />
        <view
          v-else
          class="ctx-item"
          :class="{ destructive: item.danger }"
          @click="handleClick(item)"
        >
          <AppIcon v-if="item.icon" :name="item.icon" :size="16" :color="item.danger ? 'var(--color-error)' : 'var(--color-text-primary)'" />
          <text class="ctx-item-text" :class="{ 'text-error': item.danger }">{{ item.label }}</text>
        </view>
      </template>
    </view>
  </view>

  <!-- 移动: action sheet 模式 (复用 AppDialog variant='action-sheet') -->
  <AppDialog
    v-else-if="visible && !isDesktop"
    :visible="visible"
    variant="action-sheet"
    :action-items="actionSheetItems"
    @update:visible="(v) => emit('update:visible', v)"
    @action="handleSheetAction"
  />
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import AppDialog from './AppDialog.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] }, // [{ label, icon?, danger?, divider, onClick }]
  isDesktop: { type: Boolean, default: true }
});

const emit = defineEmits(['update:visible', 'select']);

function noop() {}

const xPx = computed(() => {
  const w = typeof window !== 'undefined' ? window.innerWidth : 375;
  return `${Math.min(Math.max(props.x, 8), w - 160)}px`;
});
const yPx = computed(() => {
  const h = typeof window !== 'undefined' ? window.innerHeight : 600;
  return `${Math.min(Math.max(props.y, 8), h - 40)}px`;
});

const actionSheetItems = computed(() =>
  props.items
    .filter((i) => !i.divider)
    .map((i) => ({ label: i.label, danger: !!i.danger, onClick: () => emit('select', i) }))
);

function handleClick(item) {
  emit('select', item);
  emit('update:visible', false);
}

function handleSheetAction() {}
</script>

<style scoped>
.ctx-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
.ctx-menu {
  position: absolute;
  border-radius: 12px;
  padding: 6px 0;
  min-width: 140px;
  max-width: 240px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-surface);
}
.ctx-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.ctx-item:active {
  background-color: var(--color-bg-hover);
}
.ctx-item.destructive .ctx-item-text {
  color: var(--color-error);
}
.ctx-item-text {
  font-size: 14px;
  color: var(--color-text-primary);
}
.text-error {
  color: var(--color-error);
}
.ctx-divider {
  height: 1px;
  background-color: var(--color-border);
  margin: 4px 0;
}
</style>
