<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { apiClient } from '@tsdaodao/base-vue';
import { useClowderStore, type ClowderAgent, type CoordinatorKickoff } from '@tsdaodao/datasource-vue';
import CatWorkBadge from './CatWorkBadge.vue';

defineOptions({ name: 'CoordinatorKickoffCard' });

interface Props {
  kickoff: CoordinatorKickoff;
  channelId: string;
  channelType: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (event: 'created', threadId: string): void;
  (event: 'dismissed'): void;
}>();

const clowderStore = useClowderStore();

const title = ref(`项目群聊 · ${new Date().toLocaleDateString('zh-CN')}`);
const projectPath = ref('');
const selectedCatIds = ref<Set<string>>(new Set(props.kickoff.suggestedCats ?? []));
const showAddMore = ref(false);
const availableExtraCats = ref<ClowderAgent[]>([]);
const creating = ref(false);
const createError = ref<string | null>(null);
const pathError = ref<string | null>(null);
const pathValidating = ref(false);
const pathHint = ref<string | null>(null);

const recommendedAgents = computed<ClowderAgent[]>(() => {
  const directory = clowderStore.agentDirectories[`${props.channelId}-${props.channelType}`];
  const all = directory?.agents ?? [];
  const byId = new Map(all.map((a) => [a.catId, a] as const));
  return (props.kickoff.suggestedCats ?? [])
    .map((id) => byId.get(id))
    .filter((a): a is ClowderAgent => Boolean(a));
});

const allAgents = computed<ClowderAgent[]>(() => {
  const directory = clowderStore.agentDirectories[`${props.channelId}-${props.channelType}`];
  return directory?.agents ?? [];
});

watch(
  allAgents,
  (agents) => {
    const recommended = new Set(props.kickoff.suggestedCats ?? []);
    availableExtraCats.value = agents.filter((a) => !recommended.has(a.catId));
  },
  { immediate: true },
);

function toggleCat(catId: string) {
  const next = new Set(selectedCatIds.value);
  if (next.has(catId)) {
    next.delete(catId);
  } else {
    next.add(catId);
  }
  selectedCatIds.value = next;
}

async function validatePath() {
  pathError.value = null;
  pathHint.value = null;
  const trimmed = projectPath.value.trim();
  if (!trimmed) {
    return;
  }
  pathValidating.value = true;
  try {
    const response = await apiClient.get<{
      valid: boolean;
      absolute?: string;
      reason?: string;
    }>('clowder/workspace/validate', { params: { path: trimmed } });
    const data = response.data;
    if (!data || typeof data !== 'object') {
      pathError.value = '路径校验失败';
      return;
    }
    if (data.valid) {
      pathHint.value = `已锁定到 ${data.absolute}`;
    } else {
      pathError.value = data.reason || '路径无效';
    }
  } catch (err) {
    pathError.value = err instanceof Error ? err.message : '路径校验失败';
  } finally {
    pathValidating.value = false;
  }
}

watch(projectPath, (next) => {
  if (next.trim().length > 0) {
    void validatePath();
  } else {
    pathError.value = null;
    pathHint.value = null;
  }
});

async function handleCreate() {
  if (creating.value) return;
  const trimmedTitle = title.value.trim();
  if (!trimmedTitle) {
    createError.value = '请填写群聊标题';
    return;
  }
  if (!projectPath.value.trim()) {
    createError.value = '请填写项目路径(workspace 内的目录)';
    return;
  }
  if (selectedCatIds.value.size === 0) {
    createError.value = '请至少选择一只猫加入群聊';
    return;
  }
  creating.value = true;
  createError.value = null;
  try {
    const response = await fetch(
      '/v1/threads',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          projectPath: projectPath.value.trim(),
          preferredCats: Array.from(selectedCatIds.value),
        }),
      },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `创建失败 (${response.status})`);
    }
    const data = (await response.json()) as { thread?: { id?: string } };
    const threadId = data.thread?.id;
    if (!threadId) {
      throw new Error('后端未返回 threadId');
    }
    await clowderStore.dismissKickoff(props.kickoff.coordinationId);
    emit('created', threadId);
  } catch (err) {
    createError.value = err instanceof Error ? err.message : '创建群聊失败';
  } finally {
    creating.value = false;
  }
}

async function handleDismiss() {
  if (creating.value) return;
  await clowderStore.dismissKickoff(props.kickoff.coordinationId);
  emit('dismissed');
}

onMounted(() => {
  // ensure agentDirectory is loaded so the recommendedCats + extra pool have data
  if (!clowderStore.agentDirectories[`${props.channelId}-${props.channelType}`]) {
    clowderStore
      .loadAgentDirectory({ channelId: props.channelId, channelType: props.channelType as 1 | 2 })
      .catch(() => undefined);
  }
});
</script>

<template>
  <div class="coordinator-kickoff-card" role="region" aria-label="项目群聊启动卡片">
    <div class="coordinator-kickoff-card__header">
      <div class="coordinator-kickoff-card__icon" aria-hidden="true">📁</div>
      <div class="coordinator-kickoff-card__heading">
        <div class="coordinator-kickoff-card__title">为这个项目创建群聊?</div>
        <div v-if="kickoff.reason" class="coordinator-kickoff-card__reason">
          {{ kickoff.reason }}
        </div>
      </div>
    </div>

    <div class="coordinator-kickoff-card__body">
      <div class="coordinator-kickoff-card__label">协调者推荐的猫猫</div>
      <div v-if="recommendedAgents.length === 0" class="coordinator-kickoff-card__empty">
        (协调者推荐的猫尚未在当前目录,稍等目录加载完成)
      </div>
      <div v-else class="coordinator-kickoff-card__agents">
        <CatWorkBadge
          v-for="cat in recommendedAgents"
          :key="cat.catId"
          :cat="cat"
          :available="cat.available"
          :selected="selectedCatIds.has(cat.catId)"
          :on-toggle="() => toggleCat(cat.catId)"
        />
      </div>

      <button
        type="button"
        class="coordinator-kickoff-card__add-more"
        :aria-expanded="showAddMore"
        @click="showAddMore = !showAddMore"
      >
        {{ showAddMore ? '收起候选猫' : '+ 添加更多猫' }}
      </button>

      <div v-if="showAddMore" class="coordinator-kickoff-card__extras">
        <CatWorkBadge
          v-for="cat in availableExtraCats"
          :key="cat.catId"
          :cat="cat"
          :available="cat.available"
          :selected="selectedCatIds.has(cat.catId)"
          :on-toggle="() => toggleCat(cat.catId)"
        />
      </div>

      <div class="coordinator-kickoff-card__form">
        <label class="coordinator-kickoff-card__field">
          <span>群聊标题</span>
          <input
            v-model="title"
            type="text"
            maxlength="200"
            placeholder="给这个项目起个名字"
          />
        </label>
        <label class="coordinator-kickoff-card__field">
          <span>项目路径(workspace 内)</span>
          <input
            v-model="projectPath"
            type="text"
            placeholder="例如: ~/projects/todo-app 或 /Users/me/projects/todo-app"
          />
          <span v-if="pathError" class="coordinator-kickoff-card__hint coordinator-kickoff-card__hint--err">
            {{ pathError }}
          </span>
          <span v-else-if="pathValidating" class="coordinator-kickoff-card__hint">
            校验中…
          </span>
          <span v-else-if="pathHint" class="coordinator-kickoff-card__hint">
            {{ pathHint }}
          </span>
        </label>
      </div>

      <p v-if="createError" class="coordinator-kickoff-card__error" role="alert">
        {{ createError }}
      </p>
    </div>

    <div class="coordinator-kickoff-card__actions">
      <button
        type="button"
        class="coordinator-kickoff-card__btn coordinator-kickoff-card__btn--ghost"
        :disabled="creating"
        @click="handleDismiss"
      >
        稍后再说
      </button>
      <button
        type="button"
        class="coordinator-kickoff-card__btn coordinator-kickoff-card__btn--primary"
        :disabled="creating"
        @click="handleCreate"
      >
        {{ creating ? '创建中…' : '创建群聊' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.coordinator-kickoff-card {
  background: var(--color-bg-1, #fdf8f3);
  border: 1px solid var(--color-border-2, #e5e0d8);
  border-radius: 16px;
  padding: 16px;
  margin: 8px 12px 12px;
  max-width: 560px;
  box-shadow: 0 6px 18px rgba(43, 33, 26, 0.06);
}

.coordinator-kickoff-card__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.coordinator-kickoff-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary-light, #eef2ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.coordinator-kickoff-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1, #1a1a1a);
}

.coordinator-kickoff-card__reason {
  margin-top: 4px;
  font-size: 13px;
  color: var(--color-text-3, #6b6b6b);
}

.coordinator-kickoff-card__label {
  font-size: 12px;
  color: var(--color-text-3, #6b6b6b);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.coordinator-kickoff-card__agents,
.coordinator-kickoff-card__extras {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.coordinator-kickoff-card__empty {
  font-size: 12px;
  color: var(--color-text-3, #6b6b6b);
  font-style: italic;
  margin-bottom: 8px;
}

.coordinator-kickoff-card__add-more {
  background: transparent;
  border: 1px dashed var(--color-border-2, #d8d2c7);
  color: var(--color-primary, #6b8afd);
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 8px;
}

.coordinator-kickoff-card__form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.coordinator-kickoff-card__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-3, #6b6b6b);
}

.coordinator-kickoff-card__field input {
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid var(--color-border-2, #d8d2c7);
  border-radius: 8px;
  background: var(--color-bg-2, #fff);
  color: var(--color-text-1, #1a1a1a);
  font-family: inherit;
}

.coordinator-kickoff-card__field input:focus {
  outline: 2px solid var(--color-primary, #6b8afd);
  outline-offset: -1px;
  border-color: transparent;
}

.coordinator-kickoff-card__hint {
  font-size: 11px;
  color: var(--color-text-3, #6b6b6b);
}

.coordinator-kickoff-card__hint--err {
  color: #c2410c;
}

.coordinator-kickoff-card__error {
  margin-top: 10px;
  padding: 8px 10px;
  background: rgba(220, 90, 90, 0.08);
  border-radius: 8px;
  color: #c2410c;
  font-size: 12px;
}

.coordinator-kickoff-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.coordinator-kickoff-card__btn {
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.coordinator-kickoff-card__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.coordinator-kickoff-card__btn--ghost {
  background: transparent;
  color: var(--color-text-2, #3a3a3a);
}

.coordinator-kickoff-card__btn--ghost:hover:not(:disabled) {
  background: var(--color-fill-2, #f2efe9);
}

.coordinator-kickoff-card__btn--primary {
  background: var(--color-primary, #6b8afd);
  color: #fff;
}

.coordinator-kickoff-card__btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover, #5577eb);
}
</style>
