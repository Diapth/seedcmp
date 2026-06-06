<script setup lang="ts">
import { computed } from 'vue';
import type { ClowderAgent } from '@tsdaodao/datasource-vue';

defineOptions({ name: 'CatWorkBadge' });

interface Props {
  cat: ClowderAgent;
  selected?: boolean;
  available?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  available: true,
  onToggle: undefined,
  compact: false,
});

const initial = computed(() => {
  const name = props.cat.displayName || props.cat.catId;
  return name.charAt(0).toUpperCase();
});

const strengths = computed<string[]>(() => {
  const a = props.cat as unknown as { strengths?: unknown };
  if (Array.isArray(a.strengths)) {
    return a.strengths.filter((s): s is string => typeof s === 'string');
  }
  return [];
});

const roleDescription = computed(() => {
  const a = props.cat as unknown as { roleDescription?: unknown };
  return typeof a.roleDescription === 'string' ? a.roleDescription : '';
});

const avatarColor = computed(() => {
  // Pull a brand color from the agent payload if present, else fall back to a
  // soft beige so the badge remains visually distinct from message bubbles.
  const a = props.cat as unknown as { color?: { primary?: string } };
  return a.color?.primary ?? '#9B7EBD';
});
</script>

<template>
  <button
    type="button"
    class="cat-work-badge"
    :class="[compact ? 'cat-work-badge--compact' : 'cat-work-badge--full', { 'is-selected': selected, 'is-unavailable': !available }]"
    :disabled="!available"
    :aria-pressed="selected"
    @click="props.onToggle"
  >
    <div class="cat-work-badge__avatar" :style="{ backgroundColor: avatarColor }">
      <span class="cat-work-badge__initial">{{ initial }}</span>
    </div>
    <div class="cat-work-badge__body">
      <div class="cat-work-badge__name">
        {{ cat.displayName || cat.catId }}
        <span v-if="!available" class="cat-work-badge__pill cat-work-badge__pill--offline">离线</span>
      </div>
      <div v-if="roleDescription" class="cat-work-badge__role">{{ roleDescription }}</div>
      <div v-if="!compact && strengths.length > 0" class="cat-work-badge__strengths">
        <span v-for="s in strengths" :key="s" class="cat-work-badge__pill">{{ s }}</span>
      </div>
    </div>
    <div v-if="props.onToggle" class="cat-work-badge__check" aria-hidden="true">
      <span v-if="selected">✓</span>
    </div>
  </button>
</template>

<style scoped>
.cat-work-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: var(--color-bg-2, #fff);
  border: 1px solid var(--color-border-2, #e5e0d8);
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  color: inherit;
  font: inherit;
}

.cat-work-badge:hover:not(:disabled) {
  border-color: var(--color-primary, #6b8afd);
}

.cat-work-badge.is-selected {
  border-color: var(--color-primary, #6b8afd);
  background: var(--color-primary-light, #eef2ff);
  box-shadow: 0 0 0 2px rgba(107, 138, 253, 0.18);
}

.cat-work-badge.is-unavailable {
  opacity: 0.55;
  cursor: not-allowed;
}

.cat-work-badge--compact {
  padding: 6px 8px;
  gap: 8px;
  border-radius: 10px;
}

.cat-work-badge__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
}

.cat-work-badge--compact .cat-work-badge__avatar {
  width: 28px;
  height: 28px;
  font-size: 13px;
}

.cat-work-badge__initial {
  font-size: 16px;
}

.cat-work-badge__body {
  flex: 1;
  min-width: 0;
}

.cat-work-badge__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1, #1a1a1a);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cat-work-badge--compact .cat-work-badge__name {
  font-size: 13px;
  font-weight: 500;
}

.cat-work-badge__role {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-text-3, #6b6b6b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-work-badge--compact .cat-work-badge__role {
  display: none;
}

.cat-work-badge__strengths {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cat-work-badge__pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  background: var(--color-fill-2, #f2efe9);
  border-radius: 999px;
  color: var(--color-text-2, #3a3a3a);
}

.cat-work-badge__pill--offline {
  background: rgba(220, 90, 90, 0.12);
  color: #c2410c;
}

.cat-work-badge__check {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--color-primary, #6b8afd);
  font-weight: 600;
}
</style>
