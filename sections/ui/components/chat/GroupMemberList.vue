<template>
  <view class="group-member-list flex-column">
    <view
      v-for="m in members"
      :key="m.id"
      class="member-row flex-row align-center justify-between"
      @click="$emit('select', m)"
      @contextmenu.prevent.stop="handleMemberContextMenu($event, m)"
      @longpress.stop="handleMemberContextMenu($event, m)"
    >
      <view class="flex-row align-center gap-2 min-w-0">
        <AppAvatar :src="m.avatar" :text="memberDisplayName(m)" :size="42" />
        <view class="member-copy flex-column">
          <text class="member-name">{{ memberDisplayName(m) }}</text>
          <text v-if="m.remark" class="member-nickname">{{ m.nickname }}</text>
        </view>
      </view>
      <text class="role-badge" :class="m.role">{{ roleLabel(m.role) }}</text>
    </view>
  </view>
</template>

<script setup>
import AppAvatar from '../common/AppAvatar.vue';

defineProps({
  members: { type: Array, default: () => [] }
});

const emit = defineEmits(['select', 'member-contextmenu']);

function roleLabel(role) {
  if (role === 'owner') return '群主';
  if (role === 'admin') return '管理员';
  return '成员';
}

function memberDisplayName(member) {
  return member.remark || member.nickname;
}

function handleMemberContextMenu(event, member) {
  emit('member-contextmenu', { event, member });
}
</script>

<style scoped>
.group-member-list {
  gap: 0;
}

.member-row {
  padding: 10px 4px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  cursor: pointer;
  align-items: center;
}

.member-row:last-child {
  border-bottom: none;
}

.member-row:active {
  background-color: var(--color-bg-hover);
}

.gap-2 {
  gap: 10px;
}

.min-w-0 {
  min-width: 0;
}

.member-copy {
  min-width: 0;
}

.member-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-nickname {
  font-size: 11px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.role-badge.owner {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

.role-badge.admin {
  background-color: var(--color-bg-muted);
  color: var(--color-text-secondary);
}

.role-badge.member {
  background-color: transparent;
  color: var(--color-text-muted);
}
</style>
