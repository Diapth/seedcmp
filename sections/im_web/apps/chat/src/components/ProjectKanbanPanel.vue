<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useClowderStore, type ClowderAgent, type ClowderThreadTask } from '@tsdaodao/datasource-vue';
import CatWorkBadge from './CatWorkBadge.vue';

defineOptions({ name: 'ProjectKanbanPanel' });

interface Props {
  threadId: string;
  agentDirectory?: ClowderAgent[];
  observedTaskIds?: string[];
}

const props = defineProps<Props>();

type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done';
type TaskItem = ClowderThreadTask;

const clowderStore = useClowderStore();
let pollTimer: ReturnType<typeof setInterval> | null = null;

const SECTIONS: Array<{ key: TaskStatus; label: string; icon: string }> = [
  { key: 'doing', label: '进行中', icon: '◉' },
  { key: 'blocked', label: '阻塞中', icon: '⊘' },
  { key: 'todo', label: '待办', icon: '○' },
  { key: 'done', label: '已完成', icon: '●' },
];

const loadState = computed(() => clowderStore.getThreadTasksState(props.threadId));
const tasks = computed<TaskItem[]>(() => ('tasks' in loadState.value ? loadState.value.tasks : []));
const loading = computed(() => loadState.value.state === 'loading');
const routeError = computed(() => loadState.value.state === 'route_failed' ? loadState.value : null);
const mismatch = computed(() => loadState.value.state === 'thread_binding_mismatch' ? loadState.value : null);
const diagnostics = computed(() => ('diagnostics' in loadState.value ? loadState.value.diagnostics : undefined));
const observedTaskIdsKey = computed(() => (props.observedTaskIds || []).join(','));
const successEmpty = computed(() => loadState.value.state === 'success_empty');
const createdTaskMissing = computed(() => diagnostics.value?.state === 'created_task_missing');

const tasksByStatus = computed(() => {
  const map: Record<TaskStatus, TaskItem[]> = {
    todo: [],
    doing: [],
    blocked: [],
    done: [],
  };
  for (const t of tasks.value) {
    const status = (SECTIONS.find((s) => s.key === t.status) ? t.status : 'todo') as TaskStatus;
    map[status].push(t);
  }
  for (const status of SECTIONS) {
    map[status.key].sort((a, b) => a.updatedAt - b.updatedAt);
  }
  return map;
});

const tasksByOwner = computed(() => {
  const map = new Map<string, TaskItem[]>();
  for (const t of tasks.value) {
    if (!t.ownerCatId) continue;
    const list = map.get(t.ownerCatId) ?? [];
    list.push(t);
    map.set(t.ownerCatId, list);
  }
  return Array.from(map.entries()).map(([ownerCatId, items]) => ({
    ownerCatId,
    items,
  }));
});

function lookupAgent(catId: string): ClowderAgent | undefined {
  return props.agentDirectory?.find((a) => a.catId === catId);
}

function shortTaskId(taskId: string): string {
  const parts = taskId.split('-');
  return parts.length > 1 ? parts.slice(-2).join('-') : taskId.slice(-12);
}

async function refresh() {
  if (!props.threadId) return;
  await clowderStore.fetchThreadTasks(props.threadId, {
    observedTaskIds: props.observedTaskIds?.length ? props.observedTaskIds : undefined,
  });
}

onMounted(() => {
  void refresh();
  pollTimer = setInterval(() => {
    void refresh();
  }, 10_000);
});

watch(
  () => props.threadId,
  () => {
    void refresh();
  },
);

watch(observedTaskIdsKey, (next, previous) => {
  if (next !== previous) void refresh();
});

onUnmounted(() => {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});

defineExpose({ refresh });
</script>

<template>
  <div class="kanban-panel" data-testid="project-kanban-panel">
    <div class="kanban-panel__header">
      <h4>看板</h4>
      <button
        type="button"
        class="kanban-panel__refresh"
        :disabled="loading"
        @click="refresh"
      >
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
    </div>

    <p v-if="loading && tasks.length === 0" class="kanban-panel__empty">加载任务中…</p>
    <p v-else-if="routeError" class="kanban-panel__error">
      任务查询失败<span v-if="routeError.status"> ({{ routeError.status }})</span>：{{ routeError.error }}
    </p>
    <p v-else-if="mismatch" class="kanban-panel__error">
      聊天中的任务 {{ mismatch.expectedTaskId || '已创建任务' }} 属于 Thread
      {{ mismatch.actualThreadId || '未知' }}，当前看板查询的是 {{ mismatch.threadId }}。
    </p>
    <p v-else-if="createdTaskMissing" class="kanban-panel__error">
      聊天中出现的任务 id 未在任务存储中找到，请刷新 conversation 或稍后重试。
    </p>
    <p
      v-else-if="successEmpty"
      class="kanban-panel__empty"
    >
      还没有任务。让协调者分配任务后,这里会显示各猫的工作状态。
    </p>

    <div v-if="tasks.length > 0" class="kanban-panel__columns">
      <section
        v-for="section in SECTIONS"
        :key="section.key"
        class="kanban-panel__column"
      >
        <header class="kanban-panel__column-header">
          <span class="kanban-panel__icon">{{ section.icon }}</span>
          <span class="kanban-panel__label">{{ section.label }}</span>
          <span class="kanban-panel__count">{{ tasksByStatus[section.key].length }}</span>
        </header>
        <ul class="kanban-panel__list">
          <li
            v-for="task in tasksByStatus[section.key]"
            :key="task.id"
            class="kanban-panel__task"
          >
            <div class="kanban-panel__task-title">{{ task.title }}</div>
            <div class="kanban-panel__task-id">#{{ shortTaskId(task.id) }}</div>
            <div v-if="task.why" class="kanban-panel__task-why">{{ task.why }}</div>
            <div class="kanban-panel__task-owner">
              <CatWorkBadge
                v-if="task.ownerCatId && lookupAgent(task.ownerCatId)"
                :cat="lookupAgent(task.ownerCatId)!"
                :available="true"
                :selected="false"
                compact
              />
              <span v-else class="kanban-panel__owner-name">
                {{ task.ownerCatId ? `@${task.ownerCatId}` : '未分配' }}
              </span>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <details v-if="tasksByOwner.length > 0" class="kanban-panel__by-owner">
      <summary>按猫猫查看 ({{ tasksByOwner.length }})</summary>
      <div class="kanban-panel__owner-groups">
        <section
          v-for="group in tasksByOwner"
          :key="group.ownerCatId"
          class="kanban-panel__owner-group"
        >
          <header class="kanban-panel__owner-header">
            <CatWorkBadge
              v-if="lookupAgent(group.ownerCatId)"
              :cat="lookupAgent(group.ownerCatId)!"
              :available="true"
              :selected="false"
              compact
            />
            <span v-else class="kanban-panel__owner-name">
              @{{ group.ownerCatId }}
            </span>
            <span class="kanban-panel__count">
              {{ group.items.filter((t) => t.status === 'doing').length }} doing /
              {{ group.items.filter((t) => t.status === 'done').length }} done
            </span>
          </header>
        </section>
      </div>
    </details>
  </div>
</template>

<style scoped>
.kanban-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-1, #fdf8f3);
  border: 1px solid var(--color-border-2, #e5e0d8);
  border-radius: 14px;
}

.kanban-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kanban-panel__header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.kanban-panel__refresh {
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid var(--color-border-2, #d8d2c7);
  background: var(--color-bg-2, #fff);
  border-radius: 6px;
  cursor: pointer;
}

.kanban-panel__refresh:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.kanban-panel__empty,
.kanban-panel__error {
  font-size: 12px;
  color: var(--color-text-3, #6b6b6b);
  margin: 0;
}

.kanban-panel__error {
  color: #c2410c;
}

.kanban-panel__columns {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

@media (max-width: 720px) {
  .kanban-panel__columns {
    grid-template-columns: repeat(2, 1fr);
  }
}

.kanban-panel__column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--color-bg-2, #fff);
  border: 1px solid var(--color-border-2, #e5e0d8);
  border-radius: 10px;
  padding: 8px;
  min-height: 60px;
}

.kanban-panel__column-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-3, #6b6b6b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 700;
}

.kanban-panel__icon {
  font-size: 12px;
}

.kanban-panel__label {
  flex: 1;
}

.kanban-panel__count {
  font-size: 11px;
  background: var(--color-fill-2, #f2efe9);
  padding: 1px 6px;
  border-radius: 999px;
}

.kanban-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kanban-panel__task {
  padding: 6px 8px;
  background: var(--color-bg-1, #fdf8f3);
  border: 1px solid var(--color-border-2, #e5e0d8);
  border-radius: 6px;
}

.kanban-panel__task-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-1, #1a1a1a);
  word-break: break-word;
}

.kanban-panel__task-id {
  margin-top: 2px;
  font-size: 10px;
  color: var(--color-text-3, #6b6b6b);
  word-break: break-all;
}

.kanban-panel__task-why {
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-3, #6b6b6b);
  word-break: break-word;
}

.kanban-panel__task-owner {
  margin-top: 4px;
}

.kanban-panel__owner-name {
  font-size: 11px;
  color: var(--color-text-2, #3a3a3a);
  font-weight: 600;
}

.kanban-panel__by-owner {
  font-size: 12px;
  color: var(--color-text-3, #6b6b6b);
}

.kanban-panel__by-owner summary {
  cursor: pointer;
  padding: 4px 0;
  font-weight: 600;
}

.kanban-panel__owner-groups {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.kanban-panel__owner-group {
  display: flex;
  flex-direction: column;
}

.kanban-panel__owner-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
