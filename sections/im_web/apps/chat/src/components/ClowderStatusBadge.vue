<script setup lang="ts">
import { computed } from 'vue';
import type { ClowderConnectionState } from '@tsdaodao/datasource-vue';

const props = defineProps<{
  state: ClowderConnectionState;
  loading?: boolean;
  reason?: string;
}>();

const label = computed(() => {
  if (props.loading) return 'Clowder connecting';
  if (props.reason === 'group_not_allowed') return 'Clowder group not allowed';
  if (props.reason === 'command_admin_only' || props.reason === 'admin_only_commands') return 'Clowder admin only';
  if (props.reason === 'permission_denied') return 'Clowder denied';
  if (props.reason) return props.reason;
  switch (props.state) {
    case 'ready':
      return 'Clowder ready';
    case 'denied':
      return 'Clowder denied';
    case 'unconfigured':
      return 'Clowder unconfigured';
    case 'error':
      return 'Clowder error';
    case 'connecting':
      return 'Clowder connecting';
    default:
      return 'Clowder disabled';
  }
});
</script>

<template>
  <span class="clowder-status-badge" :class="[`is-${state}`, { 'is-loading': loading }]" :title="label">
    {{ label }}
  </span>
</template>

<style scoped>
.clowder-status-badge {
  display: inline-flex;
  align-items: center;
  max-width: 180px;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid #d5dedb;
  border-radius: 6px;
  background: #f7faf9;
  color: #37514c;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-ready {
  border-color: #9bd5c8;
  background: #eefaf6;
  color: #0f766e;
}

.is-denied,
.is-error {
  border-color: #f1b6b6;
  background: #fff5f5;
  color: #b42318;
}

.is-unconfigured,
.is-disabled {
  border-color: #d6d9de;
  background: #f7f7f8;
  color: #60646c;
}

.is-loading,
.is-connecting {
  border-color: #b9c7e8;
  background: #f4f7ff;
  color: #3157a4;
}
</style>
