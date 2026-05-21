<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'relogin'): void;
}>();
</script>

<template>
  <div v-if="visible" class="kickout-overlay">
    <div class="kickout-card">
      <h3 class="kickout-title">下线通知</h3>
      <p class="kickout-message">您的账号在其他设备登录，当前会话已失效。如非本人操作，请重新登录并修改密码。</p>
      <button class="kickout-btn" @click="emit('relogin')">重新登录</button>
    </div>
  </div>
</template>

<style scoped>
.kickout-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.kickout-card {
  width: 320px;
  background: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  padding: 24px;
  text-align: center;
  color: var(--text-main);
}

.kickout-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.kickout-message {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}

.kickout-btn {
  width: 100%;
  padding: 10px;
  background: var(--color-accent);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.kickout-btn:hover {
  opacity: 0.9;
}
</style>
