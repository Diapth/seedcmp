<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRemoteConfig } from '@tsdaodao/base-vue';

const { remoteConfig, fetchRemoteConfig } = useRemoteConfig();
const recentAppIds = ref<string[]>(JSON.parse(localStorage.getItem('tsdd-recent-workplace-apps') || '[]'));

const fallbackApps = [
  { id: 'contacts', name: '通讯录', category: '协作', route: '/chat', order: 1, enabled: true },
  { id: 'files', name: '文件助手', category: '工具', route: '/chat/conversation/filehelper/1', order: 2, enabled: true },
  { id: 'reports', name: '举报与反馈', category: '安全', route: '', order: 3, enabled: true }
];

const workplaceApps = computed(() => {
  const apps = remoteConfig.value.workplace_apps?.length ? remoteConfig.value.workplace_apps : fallbackApps;
  return apps.filter((app: any) => app.enabled !== false);
});

const sortedWorkplaceApps = computed(() => {
  return [...workplaceApps.value].sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
});

const groupedApps = computed(() => {
  return sortedWorkplaceApps.value.reduce<Record<string, any[]>>((acc, app: any) => {
    const category = app.category || '常用';
    acc[category] = acc[category] || [];
    acc[category].push(app);
    return acc;
  }, {});
});

const recentApps = computed(() => {
  return recentAppIds.value
    .map(id => workplaceApps.value.find((app: any) => app.id === id))
    .filter((app): app is NonNullable<typeof app> => Boolean(app));
});

const workplaceVisible = computed(() => remoteConfig.value.feature_visibility?.workplace !== false);
const updatePrompt = computed(() => remoteConfig.value.update_prompt);

function persistRecentApps() {
  localStorage.setItem('tsdd-recent-workplace-apps', JSON.stringify(recentAppIds.value.slice(0, 8)));
}

function toggleRecentApp(app: any) {
  if (recentAppIds.value.includes(app.id)) {
    recentAppIds.value = recentAppIds.value.filter(id => id !== app.id);
  } else {
    recentAppIds.value = [app.id, ...recentAppIds.value];
  }
  persistRecentApps();
}

function openWorkplaceApp(app: any) {
  toggleRecentApp(app);
  if (app.url) {
    window.open(app.url, '_blank', 'noopener,noreferrer');
  } else if (app.route) {
    window.location.href = app.route;
  }
}

onMounted(() => {
  fetchRemoteConfig();
});
</script>

<template>
  <div class="welcome-container">
    <div class="welcome-inner">
      <div class="logo-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="welcome-logo">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h3 class="welcome-title">开始你的极简通讯</h3>
      <p class="welcome-desc">选择左侧列表中的会话，开启纯净、高响应的高阶即时通讯。</p>

      <div v-if="updatePrompt?.enabled" class="update-prompt">
        <span>{{ updatePrompt.message || `发现新版本 ${updatePrompt.version}` }}</span>
        <a v-if="updatePrompt.url" :href="updatePrompt.url" target="_blank" rel="noreferrer">更新</a>
      </div>

      <section v-if="workplaceVisible" class="workplace-panel">
        <div class="workplace-header">
          <span>工作台</span>
          <span>{{ sortedWorkplaceApps.length }} 个应用</span>
        </div>

        <div v-if="recentApps.length" class="recent-row">
          <button
            v-for="app in recentApps"
            :key="app.id"
            class="recent-chip"
            @click="openWorkplaceApp(app)"
          >
            {{ app.name }}
          </button>
        </div>

        <div class="app-groups">
          <div v-for="(apps, category) in groupedApps" :key="category" class="app-group">
            <div class="app-category">{{ category }}</div>
            <div class="app-grid">
              <button
                v-for="app in apps"
                :key="app.id"
                class="app-tile"
                @click="openWorkplaceApp(app)"
              >
                <span class="app-icon">{{ app.icon || app.name.slice(0, 1) }}</span>
                <span class="app-name">{{ app.name }}</span>
                <span class="app-action">{{ recentAppIds.includes(app.id) ? '移除常用' : '添加常用' }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.welcome-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background-color: var(--bg-primary);
  color: var(--text-secondary);
  overflow: auto;
}

.welcome-inner {
  text-align: center;
  width: min(720px, 100%);
  padding: 24px;
}

.logo-box {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
}

.welcome-logo {
  width: 32px;
  height: 32px;
  color: var(--text-primary);
}

.welcome-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.welcome-desc {
  font-size: 13px;
  line-height: 1.6;
}

.update-prompt,
.workplace-panel {
  margin-top: 20px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
}

.update-prompt {
  min-height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.workplace-panel {
  padding: 14px;
  text-align: left;
}

.workplace-header,
.app-category {
  display: flex;
  justify-content: space-between;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.recent-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.recent-chip,
.app-tile {
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
}

.recent-chip {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.app-groups {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.app-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 8px;
}

.app-tile {
  min-height: 76px;
  padding: 10px;
  display: grid;
  grid-template-columns: 28px 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px 8px;
  align-items: center;
  text-align: left;
}

.app-icon {
  grid-row: span 2;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-name {
  font-size: 13px;
  font-weight: 600;
}

.app-action {
  font-size: 11px;
  color: var(--text-secondary);
}
</style>
