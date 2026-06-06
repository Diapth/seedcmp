<template>
  <view 
    class="status-badge" 
    :class="['badge-' + type, 'status-' + status]"
  >
    <view class="badge-dot" v-if="showDot" />
    <text class="badge-text" v-if="text">{{ text }}</text>
  </view>
</template>

<script setup>
defineProps({
  status: {
    type: String, // 'online' | 'offline' | 'busy' | 'away'
    default: 'online'
  },
  type: {
    type: String, // 'dot' | 'label' | 'pill'
    default: 'label'
  },
  text: {
    type: String,
    default: ''
  },
  showDot: {
    type: Boolean,
    default: true
  }
});
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
}

/* Pill / Label layout */
.badge-pill {
  padding: 4px 8px;
  border-radius: 999px;
}
.badge-label {
  padding: 2px 6px;
  border-radius: 4px;
}

/* Online */
.status-online {
  color: var(--status-online-fg);
  background-color: var(--status-online-bg);
}
.status-online .badge-dot {
  background-color: var(--status-online-dot);
}

/* Offline */
.status-offline {
  color: var(--status-offline-fg);
  background-color: var(--status-offline-bg);
}
.status-offline .badge-dot {
  background-color: var(--status-offline-dot);
}

/* Busy */
.status-busy {
  color: var(--status-busy-fg);
  background-color: var(--status-busy-bg);
}
.status-busy .badge-dot {
  background-color: var(--status-busy-dot);
}

/* Away */
.status-away {
  color: var(--status-away-fg);
  background-color: var(--status-away-bg);
}
.status-away .badge-dot {
  background-color: var(--status-away-dot);
}
</style>
