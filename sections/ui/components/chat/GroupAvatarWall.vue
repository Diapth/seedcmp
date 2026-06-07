<template>
  <view class="avatar-wall" :class="`cols-${cols}`">
    <view
      v-for="m in display"
      :key="m.id"
      class="wall-cell"
      @click="$emit('select', m)"
      @contextmenu.prevent.stop="handleMemberContextMenu($event, m)"
      @longpress.stop="handleMemberContextMenu($event, m)"
    >
      <AppAvatar :src="m.avatar" :text="memberDisplayName(m)" :size="cellSize" />
    </view>
    <view v-if="extraCount > 0" class="wall-cell wall-extra">
      <text class="extra-text">+{{ extraCount }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import AppAvatar from '../common/AppAvatar.vue';

const props = defineProps({
  members: { type: Array, default: () => [] },
  max: { type: Number, default: 9 }
});

const emit = defineEmits(['select', 'member-contextmenu']);

const cols = computed(() => {
  if (props.max <= 4) return 2;
  if (props.max <= 9) return 3;
  return 3;
});

const cellSize = computed(() => (cols.value === 2 ? 44 : 40));

const display = computed(() => props.members.slice(0, props.max));
const extraCount = computed(() => Math.max(0, props.members.length - props.max));

function memberDisplayName(member) {
  return member.remark || member.nickname;
}

function handleMemberContextMenu(event, member) {
  emit('member-contextmenu', { event, member });
}
</script>

<style scoped>
.avatar-wall {
  display: grid;
  gap: 6px 10px;
  width: 100%;
  padding: 8px 4px;
  box-sizing: border-box;
}
.cols-2 {
  grid-template-columns: repeat(2, 1fr);
}
.cols-3 {
  grid-template-columns: repeat(3, 1fr);
}
.cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

.wall-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  cursor: pointer;
}

.wall-extra {
  background-color: var(--color-bg-muted);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  margin: 0 auto;
}

.extra-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}
</style>
