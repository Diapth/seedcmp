<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { useKickoutStore } from '@tsdaodao/datasource-vue';
import { useGroupStore } from '@tsdaodao/datasource-vue';
import { KickoutOverlay, ChannelAvatar } from '@tsdaodao/base-vue';
import ConversationList from '../views/ConversationList.vue';
import { ContactList } from '@tsdaodao/contacts-vue';
import SearchResultList from '../components/SearchResultList.vue';
import MyProfileDrawer from '../views/MyProfileDrawer.vue';

// Placeholders for contacts view
const activeTab = ref<'chats' | 'contacts'>('chats');
const searchQuery = ref('');
const showMyProfileDrawer = ref(false);

const router = useRouter();
const userStore = useUserStore();
const conversationStore = useConversationStore();
const kickoutStore = useKickoutStore();
const groupStore = useGroupStore();

onMounted(async () => {
  if (userStore.isLoggedIn && userStore.currentUser) {
    await groupStore.fetchMyGroups();
    await conversationStore.syncConversations();
    conversationStore.ensureGroupConversations();
  }
});

function handleLogout() {
  userStore.logout();
  router.push('/login');
}

function handleKickoutRelogin() {
  kickoutStore.resetKickout();
  router.push('/login');
}

</script>

<template>
  <div class="main-layout">
    <!-- Left Sidebar -->
    <div class="sidebar">
      <!-- Profile & Top Bar -->
      <div class="sidebar-header">
        <div class="user-profile" @click="showMyProfileDrawer = true">
          <ChannelAvatar 
            :name="userStore.currentUser?.name" 
            :size="36" 
          />
          <div class="user-info">
            <div class="user-name">{{ userStore.currentUser?.name || '用户' }}</div>
            <div class="user-status">在线</div>
          </div>
        </div>
        <button class="logout-btn" @click="handleLogout" title="退出登录">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="logout-icon">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <!-- Search Input -->
      <div class="sidebar-search">
        <div class="search-input-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索会话/联系人/聊天记录..." 
            class="search-input"
          />
          <button v-if="searchQuery" class="clear-search-btn" @click="searchQuery = ''">
            ✕
          </button>
        </div>
      </div>

      <!-- Tab Switcher -->
      <div class="tab-switcher">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'chats' }"
          @click="activeTab = 'chats'"
        >
          会话
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'contacts' }"
          @click="activeTab = 'contacts'"
        >
          联系人
        </button>
      </div>

      <!-- List container -->
      <div class="sidebar-content">
        <SearchResultList v-if="searchQuery" :query="searchQuery" @select="searchQuery = ''" />
        <template v-else>
          <ConversationList v-if="activeTab === 'chats'" />
          <ContactList v-else />
        </template>
      </div>
    </div>

    <!-- Right Panel (Chat viewport) -->
    <div class="chat-viewport">
      <router-view />
    </div>

    <!-- Kickout Overlay -->
    <KickoutOverlay :visible="kickoutStore.isKickedOut" @relogin="handleKickoutRelogin" />

    <!-- My Profile & Settings Drawer -->
    <MyProfileDrawer :visible="showMyProfileDrawer" @close="showMyProfileDrawer = false" />
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--bg-primary);
}

.sidebar {
  width: 300px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  border-right: var(--border-hairline);
  flex-shrink: 0;
}

.sidebar-header {
  height: 64px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-primary);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: background-color 0.2s;
}

.user-profile:hover {
  background-color: var(--bg-hover);
}

.user-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.user-status {
  font-size: 11px;
  color: #52c41a; /* Clean success green */
}

.logout-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.logout-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.logout-icon {
  width: 18px;
  height: 18px;
}

.tab-switcher {
  display: flex;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-primary);
}

.tab-btn {
  flex: 1;
  height: 40px;
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--primary-color, #165dff);
  border-bottom-color: var(--primary-color, #165dff);
  font-weight: 600;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  background-color: var(--bg-primary);
}

.chat-viewport {
  flex: 1;
  height: 100%;
  background-color: var(--bg-primary);
}

.contacts-placeholder {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-state {
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  padding: 16px;
  background-color: var(--bg-secondary);
  font-size: 12px;
}

/* Sidebar Search Styling */
.sidebar-search {
  padding: 10px 16px;
  background-color: var(--bg-primary);
  border-bottom: var(--border-hairline);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
  pointer-events: none;
  opacity: 0.6;
}

.search-input {
  width: 100%;
  height: 32px;
  padding: 0 32px 0 32px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s, background-color 0.2s;
}

.search-input:focus {
  border-color: var(--primary-color, #165dff);
  background-color: var(--bg-primary);
}

.clear-search-btn {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.clear-search-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}
</style>
