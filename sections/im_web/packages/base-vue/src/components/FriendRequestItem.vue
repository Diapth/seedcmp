<script setup lang="ts">
import { ref } from 'vue';
import ChannelAvatar from './ChannelAvatar.vue';

const props = defineProps<{
  request: {
    id: string;
    uid: string;
    name: string;
    avatar?: string;
    remark?: string;
    status: number; // 0: pending, 1: accepted, 2: declined
    token: string;
  };
}>();

const emit = defineEmits(['approve', 'reject']);
const processing = ref(false);

async function handleApprove() {
  processing.value = true;
  try {
    emit('approve', props.request.token);
  } finally {
    processing.value = false;
  }
}
</script>

<template>
  <div class="request-item">
    <ChannelAvatar 
      :avatar="request.avatar" 
      :name="request.name" 
      :size="40" 
    />
    
    <div class="request-body">
      <div class="request-name">{{ request.name }}</div>
      <div class="request-remark">{{ request.remark || '申请添加你为好友' }}</div>
    </div>

    <div class="request-actions">
      <span v-if="request.status === 1" class="status-label accepted">已同意</span>
      <span v-else-if="request.status === 2" class="status-label declined">已拒绝</span>
      <div v-else class="btn-group">
        <button 
          class="action-btn approve-btn" 
          :disabled="processing"
          @click="handleApprove"
        >
          同意
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.request-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  background-color: var(--bg-primary);
  border-bottom: var(--border-hairline);
}

.request-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.request-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.request-remark {
  font-size: 12px;
  color: var(--text-secondary);
}

.request-actions {
  flex-shrink: 0;
}

.status-label {
  font-size: 12px;
  font-weight: 500;
}

.status-label.accepted {
  color: #52c41a;
}

.status-label.declined {
  color: var(--text-secondary);
}

.btn-group {
  display: flex;
  gap: 8px;
}

.action-btn {
  height: 26px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s;
}

.approve-btn {
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
}

.action-btn:hover {
  opacity: 0.9;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
