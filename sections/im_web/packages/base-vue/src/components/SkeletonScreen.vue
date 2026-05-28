<script setup lang="ts">
defineProps<{
  type: 'conversation-item' | 'message-bubble' | 'contact-list';
  count?: number;
}>();
</script>

<template>
  <div class="skeleton-container">
    <!-- 1. Conversation Item Preset -->
    <template v-if="type === 'conversation-item'">
      <div
        v-for="i in (count || 5)"
        :key="'conv-' + i"
        class="skeleton-item conv-item"
      >
        <div class="skeleton-avatar skeleton-pulse"></div>
        <div class="skeleton-content">
          <div class="skeleton-row top-row">
            <div class="skeleton-bar title-bar skeleton-pulse"></div>
            <div class="skeleton-bar time-bar skeleton-pulse"></div>
          </div>
          <div class="skeleton-bar msg-bar skeleton-pulse"></div>
        </div>
      </div>
    </template>

    <!-- 2. Message Bubble Preset -->
    <template v-else-if="type === 'message-bubble'">
      <div
        v-for="i in (count || 4)"
        :key="'msg-' + i"
        class="skeleton-item msg-bubble-item"
        :class="{ 'align-right': i % 2 === 0 }"
      >
        <div class="skeleton-avatar skeleton-pulse"></div>
        <div class="skeleton-bubble skeleton-pulse"></div>
      </div>
    </template>

    <!-- 3. Contact List Preset -->
    <template v-else-if="type === 'contact-list'">
      <div
        v-for="i in (count || 6)"
        :key="'contact-' + i"
        class="skeleton-item contact-item"
      >
        <div class="skeleton-avatar skeleton-pulse"></div>
        <div class="skeleton-bar name-bar skeleton-pulse"></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  width: 100%;
}

.skeleton-pulse {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-hover) 37%, var(--bg-secondary) 63%);
  background-size: 400% 100%;
  animation: skeleton-loading 1.4s ease infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skeleton-bar {
  height: 12px;
  border-radius: var(--radius-sm);
}

.title-bar {
  width: 30%;
  height: 14px;
}

.time-bar {
  width: 15%;
}

.msg-bar {
  width: 70%;
}

/* Message Bubble skeleton layout */
.msg-bubble-item {
  align-self: flex-start;
  max-width: 70%;
  width: 100%;
}

.msg-bubble-item.align-right {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.skeleton-bubble {
  height: 40px;
  width: 180px;
  border-radius: var(--radius-sm);
}

/* Contact List preset styling */
.contact-item {
  padding: 8px 0;
  border-bottom: var(--border-hairline);
}

.name-bar {
  width: 40%;
}
</style>
