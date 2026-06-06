<template>
  <view v-if="visible" class="mention-picker-wrapper">
    <!-- 桌面: textarea 上方 popover (相对于 input area 顶部) -->
    <view v-if="isDesktop" class="mention-popover glass-panel">
      <scroll-view scroll-y class="mention-list">
        <view
          v-for="m in filteredMembers"
          :key="m.id"
          class="mention-item flex-row align-center"
          @click="$emit('select', m)"
        >
          <AppAvatar :src="m.avatar" :text="m.nickname" :size="28" />
          <text class="mention-name flex-1">{{ m.nickname }}</text>
          <text class="mention-role" :class="m.role">{{ roleLabel(m.role) }}</text>
        </view>
        <view v-if="filteredMembers.length === 0" class="mention-empty">
          <text class="mention-empty-text">无匹配成员</text>
        </view>
      </scroll-view>
    </view>

    <!-- 移动: 复用 AppDialog bottom-sheet -->
    <AppDialog
      v-else
      :visible="visible"
      variant="bottom-sheet"
      :show-cancel="false"
      width="full"
      @update:visible="(v) => $emit('update:visible', v)"
    >
      <view class="mobile-mention flex-column">
        <text class="mobile-mention-title">选择 @ 成员</text>
        <input
          v-model="localQuery"
          type="text"
          placeholder="搜索成员..."
          class="mobile-mention-search"
        />
        <scroll-view scroll-y class="mobile-mention-scroll">
          <view
            v-for="m in filteredMobile"
            :key="m.id"
            class="mention-item flex-row align-center"
            @click="$emit('select', m); $emit('update:visible', false)"
          >
            <AppAvatar :src="m.avatar" :text="m.nickname" :size="32" />
            <text class="mention-name flex-1">{{ m.nickname }}</text>
            <text class="mention-role" :class="m.role">{{ roleLabel(m.role) }}</text>
          </view>
          <view v-if="filteredMobile.length === 0" class="mention-empty">
            <text class="mention-empty-text">无匹配成员</text>
          </view>
        </scroll-view>
      </view>
    </AppDialog>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import AppAvatar from '../common/AppAvatar.vue';
import AppDialog from '../common/AppDialog.vue';

const props = defineProps({
  visible: { type: Boolean, default: true },
  members: { type: Array, default: () => [] },
  query: { type: String, default: '' },
  isDesktop: { type: Boolean, default: true }
});

defineEmits(['select', 'close', 'update:visible']);

const localQuery = ref(props.query);

const filteredMembers = computed(() => {
  const q = (props.query || '').toLowerCase();
  if (!q) return sortedMembers.value.slice(0, 10);
  return sortedMembers.value.filter((m) => m.nickname.toLowerCase().includes(q));
});

const filteredMobile = computed(() => {
  const q = (localQuery.value || '').toLowerCase();
  if (!q) return sortedMembers.value;
  return sortedMembers.value.filter((m) => m.nickname.toLowerCase().includes(q));
});

const sortedMembers = computed(() => {
  const order = { owner: 0, admin: 1, member: 2 };
  return [...props.members].sort(
    (a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9)
  );
});

function roleLabel(role) {
  if (role === 'owner') return '群主';
  if (role === 'admin') return '管理员';
  return '成员';
}
</script>

<style scoped>
.mention-picker-wrapper {
  position: relative;
  z-index: 50;
}

.mention-popover {
  position: absolute;
  bottom: 100%;
  left: 8px;
  right: 8px;
  max-height: 200px;
  border-radius: 10px;
  background-color: var(--color-bg-surface);
  box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.18);
  border: 1px solid var(--color-border);
  margin-bottom: 6px;
  overflow: hidden;
}

.mention-list,
.mobile-mention-scroll {
  max-height: 200px;
}

.mention-item {
  padding: 8px 12px;
  gap: 10px;
  cursor: pointer;
  align-items: center;
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.mention-item:last-child {
  border-bottom: none;
}

.mention-item:active {
  background-color: var(--color-bg-hover);
}

.mention-name {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-role {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
}

.mention-role.owner {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.mention-empty {
  padding: 14px;
  text-align: center;
}

.mention-empty-text {
  font-size: 12px;
  color: var(--color-text-muted);
}

.mobile-mention {
  gap: 10px;
  max-height: 50vh;
}

.mobile-mention-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.mobile-mention-search {
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  font-size: 14px;
  background-color: var(--color-bg-base);
}

.mobile-mention-scroll {
  flex: 1;
}
</style>
