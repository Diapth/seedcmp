<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    fromUID: string;
    content?: {
      text?: string;
      mention?: { all?: boolean; uids?: string[] };
    };
    payload?: {
      text?: string;
      mention?: { all?: boolean; uids?: string[] };
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const displayText = computed(() => {
  return props.message.content?.text || props.message.payload?.text || '';
});

const mentionUids = computed(() => {
  const mention = props.message.content?.mention || props.message.payload?.mention;
  return mention?.uids || [];
});

const mentionAll = computed(() => {
  const mention = props.message.content?.mention || props.message.payload?.mention;
  return mention?.all === true;
});
</script>

<template>
  <div class="text-cell" :class="{ 'is-me': isMe }">
    <div class="bubble">
      {{ displayText }}
      <span v-if="mentionAll" class="mention-chip">@所有人</span>
      <span v-else-if="mentionUids.length > 0" class="mention-chip">@{{ mentionUids.length }}人</span>
    </div>
  </div>
</template>

<style scoped>
.text-cell {
  display: flex;
  width: 100%;
}

.bubble {
  display: inline-block;
  width: fit-content;
  max-width: min(520px, 100%);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
  border: var(--border-hairline);
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.text-cell.is-me {
  justify-content: flex-end;
}

.text-cell.is-me .bubble {
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
}

.mention-chip {
  display: inline-flex;
  margin-left: 6px;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background-color: rgba(22, 93, 255, 0.12);
  color: var(--primary-color, #165dff);
  font-size: 11px;
  font-weight: 600;
  vertical-align: baseline;
}

.text-cell.is-me .mention-chip {
  background-color: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}
</style>
