<template>
  <view class="project-kanban">
    <view v-for="column in columns" :key="column.key" class="kanban-column">
      <text class="column-title">{{ column.title }}</text>
      <view v-if="column.items.length" class="task-list">
        <view v-for="task in column.items" :key="task.id" class="task-card">
          <text class="task-title">{{ task.title }}</text>
          <text class="task-meta">{{ task.assignee || '未分配' }}</text>
        </view>
      </view>
      <text v-else class="empty-copy">暂无任务</text>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useClowderStore } from '@/stores/clowder.js';

const props = defineProps({
  threadId: {
    type: String,
    default: ''
  }
});

const clowderStore = useClowderStore();

const tasks = computed(() => clowderStore.tasks[props.threadId] || []);
const columns = computed(() => {
  const defs = [
    { key: 'todo', title: '待处理' },
    { key: 'doing', title: '进行中' },
    { key: 'review', title: '评审' },
    { key: 'done', title: '完成' }
  ];
  return defs.map((column) => ({
    ...column,
    items: tasks.value
      .filter((task) => (task.status || 'todo') === column.key || (column.key === 'done' && task.status === 'completed'))
      .map((task) => ({
        id: task.id || task.task_id || task.title,
        title: task.title || task.task || task.goal || '未命名任务',
        assignee: task.assignee || task.agentName || task.agent_id || ''
      }))
  }));
});

onMounted(() => {
  if (props.threadId) clowderStore.fetchThreadTasks(props.threadId).catch(() => undefined);
});
</script>

<style scoped>
.project-kanban {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 10px;
}

.kanban-column {
  min-height: 160px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px;
  background: var(--color-bg-surface);
}

.column-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.task-card {
  border-radius: 8px;
  background: var(--color-bg-muted);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title {
  font-size: 13px;
  color: var(--color-text-primary);
}

.task-meta,
.empty-copy {
  font-size: 12px;
  color: var(--color-text-muted);
}

@media (max-width: 767px) {
  .project-kanban {
    grid-template-columns: 1fr;
  }
}
</style>
