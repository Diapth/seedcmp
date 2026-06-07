<template>
  <view class="clowder-panel-wrapper flex-column">
    
    <!-- Title -->
    <view class="panel-section flex-column">
      <view class="section-title flex-row align-center gap-2">
        <AppIcon name="agents" :size="16" color="var(--color-primary)" />
        <text class="title-text">Clowder 协作网络</text>
      </view>
      <text class="panel-desc">协同猫通过聚合多个垂直领域的智能体，为您处理复杂的业务线和工作流。</text>
    </view>
    
    <!-- Active Agents Status -->
    <view class="panel-section flex-column">
      <text class="sub-section-title">参与协作的智能体</text>
      <view class="agent-status-list flex-column gap-2">
        <view 
          v-for="(item, idx) in activeAgents" 
          :key="idx"
          class="agent-status-item glass-panel flex-row align-center justify-between"
        >
          <view class="agent-meta flex-row align-center gap-2">
            <AppAvatar :src="''" :text="item.name" :size="28" />
            <text class="agent-name">{{ item.name }}</text>
          </view>
          <view class="status-indicator flex-row align-center gap-1">
            <view class="pulse-dot" :class="item.status" />
            <text class="status-label" :class="item.status">{{ getStatusLabel(item.status) }}</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- Collaboration Threads -->
    <view class="panel-section flex-column flex-1">
      <text class="sub-section-title">协同任务线程</text>
      <scroll-view scroll-y class="threads-scroll flex-1">
        <view class="threads-list flex-column gap-2" v-if="threads.length > 0">
          <view 
            v-for="item in threads" 
            :key="item.id"
            class="thread-card glass-panel flex-column gap-2"
          >
            <view class="thread-header flex-row align-center justify-between">
              <text class="thread-title">{{ item.title }}</text>
              <text class="thread-badge" :class="item.status">
                {{ item.status === 'completed' ? '已完成' : '协同中' }}
              </text>
            </view>
            <view class="thread-progress-box flex-row align-center gap-2">
              <progress :percent="item.progress" stroke-width="3" activeColor="var(--color-primary)" backgroundColor="var(--color-border)" class="progress-bar flex-1" />
              <text class="progress-percent">{{ item.progress }}%</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
    
    <!-- Launch Task Form -->
    <view class="panel-footer glass-panel flex-column gap-2">
      <text class="footer-title">发起新协作任务</text>
      <view class="task-input-row flex-row align-center gap-2">
        <input 
          type="text" 
          v-model="newTaskTitle" 
          placeholder="输入协同任务描述..." 
          class="task-input flex-1"
          @confirm="addTask"
        />
        <button class="btn-task-submit" @click="addTask">发起</button>
      </view>
    </view>
    
  </view>
</template>

<script setup>
import { ref } from 'vue';
import AppIcon from '../common/AppIcon.vue';
import AppAvatar from '../common/AppAvatar.vue';

const props = defineProps({
  conversationId: {
    type: String,
    required: true
  }
});

const newTaskTitle = ref('');

const activeAgents = ref([
  { name: 'DeepSeek-V3', status: 'thinking' },
  { name: 'Clowder 协同猫', status: 'idle' }
]);

const threads = ref([
  { id: 1, title: '全链路性能优化诊断', status: 'processing', progress: 60 },
  { id: 2, title: '微信H5兼容策略审查', status: 'completed', progress: 100 }
]);

function getStatusLabel(status) {
  return status === 'thinking' ? '思考中...' : '空闲';
}

function addTask() {
  const title = newTaskTitle.value.trim();
  if (!title) return;
  
  const id = Date.now();
  threads.value.unshift({
    id,
    title,
    status: 'processing',
    progress: 10
  });
  
  newTaskTitle.value = '';
  
  // Simulate progress
  activeAgents.value[0].status = 'thinking';
  activeAgents.value[1].status = 'thinking';
  
  const timer = setInterval(() => {
    const task = threads.value.find(t => t.id === id);
    if (task) {
      if (task.progress < 100) {
        task.progress += 30;
        if (task.progress > 100) task.progress = 100;
      } else {
        task.status = 'completed';
        activeAgents.value[0].status = 'thinking';
        activeAgents.value[1].status = 'idle';
        clearInterval(timer);
      }
    } else {
      clearInterval(timer);
    }
  }, 1200);
}
</script>

<style scoped>
.clowder-panel-wrapper {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.panel-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  display: flex;
}

.title-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.panel-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-top: 8px;
}

.sub-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.gap-2 {
  gap: 8px;
}

.agent-status-list {
  display: flex;
  flex-direction: column;
}

.agent-status-item {
  padding: 8px 12px;
  border-radius: 8px;
  display: flex;
}

.agent-meta {
  display: flex;
  align-items: center;
}

.agent-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.status-indicator {
  display: flex;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.pulse-dot.thinking {
  background-color: var(--color-warning);
  animation: pulse 1.2s infinite ease-in-out;
}
.pulse-dot.idle {
  background-color: var(--color-success);
}

@keyframes pulse {
  0% { transform: scale(0.85); opacity: 0.5; }
  50% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(0.85); opacity: 0.5; }
}

.status-label {
  font-size: 11px;
  font-weight: 500;
}
.status-label.thinking { color: var(--color-warning); }
.status-label.idle { color: var(--color-success); }

.threads-scroll {
  height: 100%;
}

.threads-list {
  display: flex;
  flex-direction: column;
}

.thread-card {
  padding: 12px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
}

.thread-header {
  display: flex;
}

.thread-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}

.thread-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}
.thread-badge.processing {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}
.thread-badge.completed {
  background-color: var(--color-bg-base);
  color: var(--color-success);
}

.thread-progress-box {
  display: flex;
}

.progress-bar {
  border-radius: 2px;
}

.progress-percent {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.panel-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--color-border);
  border-radius: 0;
  display: flex;
  flex-direction: column;
}

.footer-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.task-input-row {
  display: flex;
  margin-top: 6px;
}

.task-input {
  height: 32px;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--color-text-primary);
}

.btn-task-submit {
  height: 32px;
  padding: 0 12px;
  background-color: var(--color-primary);
  color: #ffffff;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.btn-task-submit::after { border: none; }
</style>
