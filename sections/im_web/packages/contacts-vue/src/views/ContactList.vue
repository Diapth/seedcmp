<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '../stores/contactStore';
import { useClowderStore, useGroupStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';

const router = useRouter();
const contactStore = useContactStore();
const groupStore = useGroupStore();
const clowderStore = useClowderStore();
const SYSTEM_ROBOT_ID = 'u_10000';
const DEEPSEEK_AI_ROBOT_ID = 'deepseek_ai_robot';
const CLOWDER_AI_ROBOT_ID = 'clowder_ai';

const clowderCatContacts = computed(() => clowderStore.catContactDirectory);
const connectedCatContacts = computed(() => clowderStore.connectedCatContacts);
const showCreateCatForm = ref(false);
const newCatName = ref('');

onMounted(() => {
  contactStore.syncContacts();
  contactStore.refreshFriendRequestUnreadCount();
  groupStore.fetchMyGroups();
  clowderStore.loadCatContactDirectory({ includeUnavailable: true }).catch(() => undefined);
});

function handleContactClick(uid: string) {
  router.push(`/chat/conversation/${uid}/1`);
}

function handleAddFriend() {
  router.push('/chat/add-friend');
}

function handleCreateGroup() {
  router.push('/chat/create-group');
}

function handleGroupClick(groupNo: string) {
  router.push(`/chat/conversation/${groupNo}/2`);
}

function handleFriendRequests() {
  router.push('/chat/friend-requests');
}

function handleConfigureRobot() {
  router.push('/chat/robots');
}

function handleSystemRobot() {
  router.push(`/chat/conversation/${SYSTEM_ROBOT_ID}/1`);
}

function handleDeepSeekRobot() {
  router.push(`/chat/conversation/${DEEPSEEK_AI_ROBOT_ID}/1`);
}

function handleClowderRobot() {
  router.push(`/chat/conversation/${CLOWDER_AI_ROBOT_ID}/1`);
}

async function handleConnectCat(catId: string) {
  const cat = await clowderStore.connectExistingCat(catId).catch(() => undefined);
  if (cat) {
    router.push(`/chat/conversation/${cat.directConversationId}/1`);
  }
}

async function handleCreateCatAndConnect() {
  const name = newCatName.value.trim();
  if (!name) return;
  const cat = await clowderStore.createCatAndConnect({
    name
  }).catch(() => undefined);
  if (cat) {
    newCatName.value = '';
    showCreateCatForm.value = false;
    router.push(`/chat/conversation/${cat.directConversationId}/1`);
  }
}

function handleCatContactClick(cat: { directConversationId: string }) {
  router.push(`/chat/conversation/${cat.directConversationId}/1`);
}

function scrollToGroupList() {
  const el = document.getElementById('saved-groups-section');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function scrollToLetter(letter: string) {
  const el = document.getElementById(`letter-${letter}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
</script>

<template>
  <div class="contact-list-container">
    <div class="quick-actions">
      <div class="action-item" @click="handleFriendRequests">
        <div class="action-icon requests-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
        <div class="action-label">新的朋友</div>
        <span
          v-if="contactStore.friendRequestUnreadCount > 0"
          class="action-badge"
        >
          {{ contactStore.friendRequestUnreadCount > 99 ? '99+' : contactStore.friendRequestUnreadCount }}
        </span>
      </div>
      
      <div class="action-item" @click="handleAddFriend">
        <div class="action-icon add-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
        <div class="action-label">添加好友</div>
      </div>

      <div class="action-item" @click="handleCreateGroup">
        <div class="action-icon create-group-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
            <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9.5" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
        <div class="action-label">发起群聊</div>
      </div>

      <div class="action-item" @click="scrollToGroupList">
        <div class="action-icon group-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div class="action-label">群聊</div>
        <span v-if="groupStore.savedGroups.length > 0" class="action-count">
          {{ groupStore.savedGroups.length }}
        </span>
      </div>

      <div class="action-item robot-config-action" @click="handleConfigureRobot">
        <div class="action-icon robot-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
            <rect x="5" y="7" width="14" height="12" rx="3" />
            <path d="M12 3v4" />
            <path d="M9 13h.01" />
            <path d="M15 13h.01" />
            <path d="M9 17h6" />
          </svg>
        </div>
        <div class="action-label">新增机器人</div>
      </div>

      <div class="action-item" @click="handleSystemRobot">
        <div class="action-icon system-robot-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
            <path d="M12 3v3" />
            <rect x="4" y="6" width="16" height="14" rx="3" />
            <path d="M9 12h.01" />
            <path d="M15 12h.01" />
            <path d="M8 16h8" />
          </svg>
        </div>
        <div class="action-label">系统机器人</div>
        <span class="action-count">u_10000</span>
      </div>

      <div class="action-item ai-robot-action" @click="handleDeepSeekRobot">
        <div class="action-icon deepseek-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
            <path d="M12 3v3" />
            <rect x="4" y="6" width="16" height="14" rx="3" />
            <path d="M8 13h.01" />
            <path d="M16 13h.01" />
            <path d="M9 17c1.5 1 4.5 1 6 0" />
            <path d="M3 11h2" />
            <path d="M19 11h2" />
          </svg>
        </div>
        <div class="action-label">DeepSeek AI</div>
        <span class="action-count robot-tag">机器人</span>
      </div>

      <div class="action-item clowder-robot-action" @click="handleClowderRobot">
        <div class="action-icon clowder-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
            <path d="M12 3v3" />
            <rect x="4" y="6" width="16" height="14" rx="3" />
            <path d="M8 13h.01" />
            <path d="M16 13h.01" />
            <path d="M9 17h6" />
            <path d="M3 11h2" />
            <path d="M19 11h2" />
          </svg>
        </div>
        <div class="action-label">Clowder AI</div>
        <span class="action-count robot-tag">Clowder</span>
      </div>

      <div class="action-item clowder-cat-action">
        <div class="action-icon clowder-cat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon">
            <circle cx="8" cy="9" r="4" />
            <circle cx="16" cy="9" r="4" />
            <path d="M4 20c.8-3 3.1-5 6-5h4c2.9 0 5.2 2 6 5" />
          </svg>
        </div>
        <div class="action-label">Clowder 猫猫</div>
        <span class="action-count">{{ connectedCatContacts.length }}</span>
        <div class="cat-action-buttons">
          <button type="button" class="cat-action-btn" @click.stop="clowderStore.loadCatContactDirectory({ includeUnavailable: true })">添加已有猫猫</button>
          <button type="button" class="cat-action-btn" @click.stop="showCreateCatForm = !showCreateCatForm">创建猫猫并连接</button>
        </div>
      </div>

      <div v-if="showCreateCatForm" class="create-cat-row">
        <input
          v-model="newCatName"
          class="create-cat-input"
          type="text"
          placeholder="猫猫名称"
          @keydown.enter="handleCreateCatAndConnect"
        />
        <button type="button" class="cat-action-btn primary" @click="handleCreateCatAndConnect">连接</button>
      </div>
    </div>

    <div class="grouped-list-wrapper">
      <div
        v-if="groupStore.savedGroups.length > 0"
        id="saved-groups-section"
        class="saved-groups-section"
      >
        <div class="group-title">群聊</div>
        <div class="group-items">
          <div
            v-for="group in groupStore.savedGroups"
            :key="group.group_no"
            class="friend-item"
            @click="handleGroupClick(group.group_no)"
          >
            <ChannelAvatar
              :avatar="group.avatar"
              :name="group.name"
              :is-group="true"
              :size="36"
            />
            <div class="friend-info">
              <span class="friend-name">{{ group.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="contactStore.groupedContacts.length === 0 && groupStore.savedGroups.length === 0" class="empty-contacts">
        <p>通讯录暂无好友</p>
      </div>

      <div v-if="clowderCatContacts.length > 0" class="clowder-cats-section">
        <div class="group-title">Clowder 猫猫</div>
        <div class="group-items">
          <div
            v-for="cat in clowderCatContacts"
            :key="cat.id"
            class="friend-item clowder-cat-contact"
            :class="{ unavailable: !cat.available }"
            @click="cat.connected ? handleCatContactClick(cat) : handleConnectCat(cat.catId)"
          >
            <ChannelAvatar
              :avatar="cat.avatar"
              :name="cat.displayName"
              :size="36"
            />
            <div class="friend-info cat-info">
              <div class="cat-title-row">
                <span class="friend-name">{{ cat.displayName }}</span>
                <span class="clowder-cat-badge">猫猫</span>
                <span v-if="cat.connected" class="cat-connected">已连接</span>
              </div>
              <span class="cat-summary">{{ cat.personalitySummary || 'Clowder 联系人' }}</span>
              <span class="cat-summary muted">{{ cat.capabilitySummary || cat.aliases.join(', ') }}</span>
            </div>
            <button
              v-if="!cat.connected"
              type="button"
              class="cat-connect-btn"
              @click.stop="handleConnectCat(cat.catId)"
            >
              添加
            </button>
          </div>
        </div>
      </div>

      <div v-else class="groups-scroller">
        <div 
          v-for="group in contactStore.groupedContacts" 
          :key="group.initial" 
          :id="`letter-${group.initial}`"
          class="contact-group"
        >
          <div class="group-title">{{ group.initial }}</div>
          <div class="group-items">
            <div 
              v-for="friend in group.list" 
              :key="friend.uid" 
              class="friend-item"
              @click="handleContactClick(friend.uid)"
            >
              <ChannelAvatar 
                :avatar="friend.avatar" 
                :name="friend.remark || friend.name" 
                :size="36" 
              />
              <div class="friend-info">
                <span class="friend-name">{{ friend.remark || friend.name }}</span>
                <span v-if="friend.remark" class="friend-alias">({{ friend.name }})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="contactStore.groupedContacts.length > 0" class="letter-quick-bar">
      <div 
        v-for="group in contactStore.groupedContacts" 
        :key="'quick-' + group.initial"
        class="quick-letter"
        @click="scrollToLetter(group.initial)"
      >
        {{ group.initial }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.contact-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-primary);
  position: relative;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-primary);
}

.action-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.action-item:hover {
  background-color: var(--bg-hover);
}

.action-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.requests-icon {
  background-color: #165dff;
}

.add-icon {
  background-color: #52c41a;
}

.create-group-icon {
  background-color: #fa8c16;
}

.group-icon {
  background-color: #722ed1;
}

.robot-icon {
  background-color: #0f766e;
}

.system-robot-icon {
  background-color: #2563eb;
}

.deepseek-icon {
  background-color: #7c3aed;
}

.clowder-icon {
  background-color: #0f766e;
}

.clowder-cat-icon {
  background-color: #0f766e;
}

.robot-config-action {
  border-top: var(--border-hairline);
}

.ai-robot-action {
  border-top: var(--border-hairline);
}

.clowder-robot-action {
  border-top: var(--border-hairline);
}

.clowder-cat-action {
  border-top: var(--border-hairline);
}

.cat-action-buttons {
  margin-left: auto;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.cat-action-btn,
.cat-connect-btn {
  height: 26px;
  padding: 0 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
}

.cat-action-btn:hover,
.cat-connect-btn:hover {
  color: var(--primary-color, #165dff);
  border-color: var(--primary-color, #165dff);
}

.cat-action-btn.primary {
  color: #ffffff;
  border-color: var(--primary-color, #165dff);
  background: var(--primary-color, #165dff);
}

.create-cat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 12px 60px;
  border-top: var(--border-hairline);
}

.create-cat-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.svg-icon {
  width: 18px;
  height: 18px;
}

.action-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.action-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background-color: #ff4d4f;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-count {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  border: var(--border-hairline);
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.grouped-list-wrapper {
  flex: 1;
  overflow-y: auto;
}

.empty-contacts {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.groups-scroller {
  padding-bottom: 24px;
}

.saved-groups-section {
  display: flex;
  flex-direction: column;
}

.contact-group {
  display: flex;
  flex-direction: column;
}

.group-title {
  padding: 6px 16px;
  background-color: var(--bg-secondary);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: var(--border-hairline);
  user-select: none;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: var(--border-hairline);
}

.friend-item:hover {
  background-color: var(--bg-hover);
}

.friend-info {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.cat-info {
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.cat-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.clowder-cat-contact.unavailable {
  opacity: 0.72;
}

.clowder-cat-badge,
.cat-connected {
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 600;
}

.clowder-cat-badge {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.1);
}

.cat-connected {
  color: var(--primary-color, #165dff);
  background: rgba(22, 93, 255, 0.08);
}

.cat-summary {
  max-width: 100%;
  color: var(--text-secondary);
  font-size: 11.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-summary.muted {
  color: var(--text-disabled, #9ca3af);
}

.friend-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-alias {
  font-size: 12px;
  color: var(--text-secondary);
}

.letter-quick-bar {
  position: absolute;
  right: 8px;
  top: 100px;
  bottom: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  z-index: 10;
  user-select: none;
}

.quick-letter {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.quick-letter:hover {
  background-color: var(--bg-hover);
  color: var(--primary-color, #165dff);
}
</style>
