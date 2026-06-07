<template>
  <view class="contact-list-wrapper flex-column">
    
    <!-- Search Box with Add Button -->
    <view class="search-box-row flex-row align-center" v-if="showSearchBar">
      <view class="search-inner flex-1">
        <AppIcon name="search" :size="16" color="var(--color-text-muted)" class="search-icon" />
        <input 
          type="text" 
          v-model="localSearchQuery" 
          placeholder="搜索联系人..." 
          class="search-input"
          placeholder-style="color: var(--color-text-muted)"
        />
      </view>
      <view class="add-btn-container">
        <button class="add-btn" title="添加" @click.stop="toggleMenu">
          <AppIcon name="plus" :size="18" color="var(--color-primary)" />
        </button>
        <!-- 下拉浮动菜单 -->
        <view class="dropdown-menu-mask" v-if="showMenu" @click.stop="showMenu = false" />
        <view class="dropdown-menu-list flex-column" v-if="showMenu" @click.stop>
          <view class="menu-item flex-row align-center gap-2" @click="handleMenuClick('add-friend')">
            <AppIcon name="user-plus" :size="15" color="#475569" />
            <text class="menu-item-text">新增朋友</text>
          </view>
          <view class="menu-item flex-row align-center gap-2" @click="handleMenuClick('create-group')">
            <AppIcon name="group-plus" :size="15" color="#475569" />
            <text class="menu-item-text">新建群聊</text>
          </view>
          <view class="menu-item flex-row align-center gap-2" @click="handleMenuClick('create-tag')">
            <AppIcon name="files" :size="15" color="#475569" />
            <text class="menu-item-text">创建分组</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Tabs (联系人 / 群聊) -->
    <view class="contacts-tabs flex-row">
      <view 
        class="tab-item flex-1" 
        :class="{ active: currentTab === 'contacts' }"
        @click="currentTab = 'contacts'"
      >
        <text class="tab-text">联系人</text>
        <view class="tab-indicator" />
      </view>
      <view 
        class="tab-item flex-1" 
        :class="{ active: currentTab === 'groups' }"
        @click="currentTab = 'groups'"
      >
        <text class="tab-text">群聊</text>
        <view class="tab-indicator" />
      </view>
    </view>
    
    <!-- Scrollable content -->
    <scroll-view scroll-y class="list-scroll flex-1">
      
      <!-- Contacts Tab -->
      <view v-if="currentTab === 'contacts'">
        <!-- 最近联系人小标题 -->
        <view class="section-header">
          <text class="section-title">最近联系人</text>
        </view>

        <view class="contacts-group" v-if="filteredContacts.length > 0">
          <view 
            v-for="item in filteredContacts" 
            :key="item.id"
            class="contact-item flex-row align-center"
            :class="{ active: activeId === item.id }"
            @click="handleSelect(item)"
          >
            <!-- 语义化底色的大写单字头像 -->
            <view class="char-avatar" :style="{ backgroundColor: getAvatarBg(item) }">
              <text class="avatar-text">{{ item.nickname.charAt(0) }}</text>
              <view class="status-dot-badge" :class="item.status" />
            </view>

            <view class="item-meta flex-1 flex-column justify-center">
              <text class="item-name">{{ item.nickname }}</text>
              <text class="item-remark" v-if="item.remark">{{ item.remark }}</text>
            </view>
          </view>
        </view>
        
        <view v-else class="empty-padding">
          <AppEmptyState icon="search" title="无匹配的联系人" />
        </view>

        <!-- 分组手风琴折叠 -->
        <view class="accordion-section flex-column">
          <view class="accordion-header flex-row align-center justify-between" @click="toggleAccordion">
            <view class="flex-row align-center gap-2">
              <AppIcon name="files" :size="16" color="#64748b" />
              <text class="accordion-title">分组</text>
            </view>
            <AppIcon :name="accordionOpen ? 'up' : 'down'" :size="12" color="#94a3b8" />
          </view>

          <view class="accordion-content flex-column" v-if="accordionOpen">
            <view 
              v-for="group in contactGroups" 
              :key="group.name"
              class="group-row flex-row align-center justify-between"
              @click="handleGroupClick(group.name)"
            >
              <view class="flex-row align-center gap-2">
                <AppIcon name="files" :size="15" color="#3b82f6" />
                <text class="group-name">{{ group.name }}</text>
              </view>
              <text class="group-count">{{ group.count }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Groups Tab -->
      <view v-else>
        <view class="section-header">
          <text class="section-title">我的群聊</text>
        </view>
        
        <view class="contacts-group" v-if="groupConversations.length > 0">
          <view 
            v-for="item in groupConversations" 
            :key="item.id"
            class="contact-item flex-row align-center"
            @click="handleSelectGroupConv(item)"
          >
            <view class="char-avatar group-avatar-bg">
              <AppIcon name="group" :size="18" color="#ffffff" />
            </view>
            <view class="item-meta flex-1 flex-column justify-center">
              <text class="item-name">{{ item.name }}</text>
              <text class="item-remark">{{ item.memberCount || 3 }} 位成员</text>
            </view>
          </view>
        </view>
        
        <view v-else class="empty-padding">
          <AppEmptyState icon="group" title="暂无群聊会话" />
        </view>
      </view>
      
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useContactStore } from '@/stores/contact';
import { useConversationStore } from '@/stores/conversation';
import AppAvatar from '../common/AppAvatar.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import AppIcon from '../common/AppIcon.vue';

const props = defineProps({
  activeId: {
    type: String,
    default: ''
  },
  searchQuery: {
    type: String,
    default: null
  },
  showSearchBar: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['select', 'click-add', 'update:searchQuery']);

const contactStore = useContactStore();
const convStore = useConversationStore();

const internalSearchQuery = ref('');
const currentTab = ref('contacts');
const accordionOpen = ref(true);
const showMenu = ref(false);

const localSearchQuery = computed({
  get: () => props.searchQuery ?? internalSearchQuery.value,
  set: (value) => {
    internalSearchQuery.value = value;
    emit('update:searchQuery', value);
  }
});

const contactGroups = ref([
  { name: '同事', count: 24 },
  { name: '朋友', count: 15 },
  { name: '家人', count: 6 }
]);

function toggleMenu() {
  showMenu.value = !showMenu.value;
}

function handleMenuClick(action) {
  showMenu.value = false;
  if (action === 'add-friend') {
    emitAdd();
  } else if (action === 'create-group') {
    uni.navigateTo({
      url: '/pages/group/create'
    });
  } else if (action === 'create-tag') {
    uni.showToast({ title: '联系人分组需接入真实接口', icon: 'none' });
  }
}

const filteredContacts = computed(() => {
  const query = localSearchQuery.value.trim().toLowerCase();
  if (!query) return contactStore.contacts;
  
  return contactStore.contacts.filter(c => {
    return c.nickname.toLowerCase().includes(query) || 
           (c.remark && c.remark.toLowerCase().includes(query));
  });
});

const groupConversations = computed(() => {
  return convStore.conversations.filter(c => c.type === 'group');
});

function handleSelect(item) {
  emit('select', item);
}

function emitAdd() {
  emit('click-add');
}

function toggleAccordion() {
  accordionOpen.value = !accordionOpen.value;
}

function handleGroupClick(groupName) {
  uni.showToast({ title: `查看分组: ${groupName}`, icon: 'none' });
}

function handleSelectGroupConv(conv) {
  // 如果是桌面端，切换至对应的群聊详情；如果是移动端，切换至群会话。
  convStore.setActiveId(conv.id, conv.channelType || conv.type || 2);
  uni.setStorageSync('active_conversation_id', conv.id);
  uni.redirectTo({ url: '/pages/chat/index' });
}

function getAvatarBg(item) {
  const colors = ['#22c55e', '#ea580c', '#e11d48', '#2563eb', '#7c3aed'];
  const code = (item.id && item.id.charCodeAt(0)) || 0;
  return colors[code % colors.length];
}
</script>

<style scoped>
.contact-list-wrapper {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-surface);
}

.search-box-row {
  padding: 12px 16px 8px;
  gap: 10px;
}

.search-inner {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  z-index: 2;
}

.search-input {
  width: 100%;
  height: 36px;
  background-color: #f1f5f9;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding-left: 36px;
  padding-right: 12px;
  box-sizing: border-box;
  font-size: 13.5px;
  color: var(--color-text-primary);
  outline: none;
}

.add-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 8px;
  border: 1px solid rgba(0, 74, 198, 0.12);
  background-color: rgba(0, 145, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  margin: 0;
  transition: all 0.2s ease;
}

.add-btn::after {
  border: none;
}

.add-btn:hover {
  background-color: rgba(0, 145, 255, 0.12);
  border-color: rgba(0, 74, 198, 0.24);
}

.add-btn:active {
  transform: scale(0.96);
}

.contacts-tabs {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 0 10px;
}

.tab-item {
  height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
}

.tab-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
}

.tab-item.active .tab-text {
  color: var(--color-primary);
  font-weight: 700;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  width: 48px;
  height: 2px;
  background-color: transparent;
  border-radius: 999px;
  transition: all 0.2s ease;
}

.tab-item.active .tab-indicator {
  background-color: var(--color-primary);
}

.list-scroll {
  height: 100%;
}

.section-header {
  padding: 16px 16px 6px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.contacts-group {
  display: flex;
  flex-direction: column;
}

.contact-item {
  padding: 10px 16px;
  gap: 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(0, 0, 0, 0.02);
  transition: all 0.16s ease;
  background-color: var(--color-bg-surface);
}

.contact-item:hover {
  background-color: var(--color-bg-hover);
}

.contact-item.active {
  background-color: rgba(95, 184, 249, 0.1); /* 图上的淡蓝紫色激活高亮底色 */
}

.char-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.avatar-text {
  color: #ffffff;
  font-size: 14.5px;
  font-weight: 700;
}

.group-avatar-bg {
  background-color: #3b82f6;
}

.status-dot-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid #ffffff;
  background-color: #94a3b8; /* 默认灰色 */
}

.status-dot-badge.online {
  background-color: #22c55e; /* 在线绿色 */
}

.status-dot-badge.away {
  background-color: #eab308; /* 忙碌黄色 */
}

.status-dot-badge.offline {
  background-color: #94a3b8; /* 离线灰色 */
}

.item-meta {
  min-width: 0;
}

.item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.item-remark {
  font-size: 11.5px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.accordion-section {
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  margin-top: 14px;
}

.accordion-header {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.accordion-header:hover {
  background-color: var(--color-bg-hover);
}

.accordion-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #475569;
}

.accordion-content {
  background-color: #fafbfc;
  padding: 4px 0;
}

.group-row {
  padding: 10px 16px 10px 32px;
  cursor: pointer;
  transition: background-color 0.16s ease;
}

.group-row:hover {
  background-color: var(--color-bg-hover);
}

.group-name {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
}

.group-count {
  font-size: 11.5px;
  font-weight: 600;
  color: #94a3b8;
}

.gap-2 {
  gap: 8px;
}

.empty-padding {
  padding: 40px 16px;
}

.add-btn-container {
  position: relative;
}

.dropdown-menu-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
  background-color: transparent;
}

.dropdown-menu-list {
  position: absolute;
  top: 42px;
  right: 0;
  z-index: 100;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.12);
  padding: 6px 0;
  width: 120px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.menu-item {
  padding: 10px 14px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
}

.menu-item:hover {
  background-color: #f1f5f9;
}

.menu-item-text {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
}
</style>
