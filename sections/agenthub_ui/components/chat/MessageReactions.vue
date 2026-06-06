<template>
  <view class="reactions-row flex-row" :class="align === 'right' ? 'align-right' : 'align-left'">
    <view
      v-for="r in reactions"
      :key="r.emoji"
      class="reaction-chip"
      :class="{ 'chip-active': r.userIds && r.userIds.includes('me') }"
      @click="$emit('toggle', r.emoji)"
      @contextmenu.prevent.stop="$emit('show-users', r.emoji)"
      @longpress="$emit('show-users', r.emoji)"
    >
      <text class="reaction-emoji">{{ r.emoji }}</text>
      <text class="reaction-count">{{ r.count }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  reactions: { type: Array, default: () => [] },
  align: { type: String, default: 'left' }
});

defineEmits(['toggle', 'show-users']);
</script>

<style scoped>
.reactions-row {
  margin-top: 4px;
  gap: 4px;
  flex-wrap: wrap;
}
.align-right {
  justify-content: flex-end;
}
.align-left {
  justify-content: flex-start;
}

.reaction-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  background-color: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.16s ease, transform 0.16s ease;
}
.reaction-chip:active {
  transform: scale(0.96);
}
.reaction-chip.chip-active {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
}

.reaction-emoji {
  font-size: 14px;
}

.reaction-count {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-weight: 600;
}
.chip-active .reaction-count {
  color: var(--color-primary);
}
</style>
