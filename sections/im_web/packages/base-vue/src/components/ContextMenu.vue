<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  x: number;
  y: number;
  items: Array<{
    label: string;
    action: () => void;
    danger?: boolean;
    disabled?: boolean;
  }>;
  reactions?: Array<{
    emoji: string;
    action: () => void;
  }>;
}>();

const emit = defineEmits(['close']);

let globalListenerTimer: ReturnType<typeof setTimeout> | null = null;

function handleItemClick(action: () => void) {
  action();
  emit('close');
}

function handleGlobalClick() {
  emit('close');
}

function handleGlobalContextMenu(event: MouseEvent) {
  event.preventDefault();
  emit('close');
}

function addGlobalListeners() {
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('contextmenu', handleGlobalContextMenu);
}

onMounted(() => {
  globalListenerTimer = setTimeout(addGlobalListeners, 0);
});

onBeforeUnmount(() => {
  if (globalListenerTimer) {
    clearTimeout(globalListenerTimer);
    globalListenerTimer = null;
  }
  document.removeEventListener('click', handleGlobalClick);
  document.removeEventListener('contextmenu', handleGlobalContextMenu);
});
</script>

<template>
  <div 
    class="context-menu" 
    :style="{ top: y + 'px', left: x + 'px' }"
    @click.stop
    @contextmenu.prevent.stop
  >
    <!-- Reactions Bar at the top of context menu -->
    <div v-if="reactions && reactions.length > 0" class="reactions-menu-bar">
      <span 
        v-for="(r, idx) in reactions" 
        :key="idx" 
        class="reaction-emoji-btn"
        @click="handleItemClick(r.action)"
      >
        {{ r.emoji }}
      </span>
    </div>

    <div 
      v-for="(item, idx) in items" 
      :key="idx" 
      class="context-menu-item"
      :class="{ danger: item.danger, disabled: item.disabled }"
      @click="item.disabled ? undefined : handleItemClick(item.action)"
    >
      {{ item.label }}
    </div>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  background-color: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  padding: 4px 0;
  min-width: 120px;
  box-shadow: none !important;
}

.context-menu-item {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.context-menu-item:hover {
  background-color: var(--bg-hover);
}

.context-menu-item.danger {
  color: #ff4d4f;
}

.context-menu-item.danger:hover {
  background-color: #ff4d4f10;
}

.context-menu-item.disabled {
  color: var(--text-disabled, #9ca3af);
  cursor: not-allowed;
}

.context-menu-item.disabled:hover {
  background-color: transparent;
}

.reactions-menu-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px 8px;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-secondary);
}

.reaction-emoji-btn {
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: background-color 0.2s, transform 0.1s;
}

.reaction-emoji-btn:hover {
  background-color: var(--bg-hover);
  transform: scale(1.2);
}
</style>
