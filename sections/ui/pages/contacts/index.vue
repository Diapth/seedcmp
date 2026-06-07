<template>
  <AppShell>
    <!-- Mobile Page Header (PR-14) -->
    <MobilePageHeader
      v-if="!isDesktop"
      title="通讯录"
      subtitle="管理好友、群组与申请"
    >
      <template #left>
        <view class="me-avatar-btn" @click="goProfile">
          <AppAvatar :src="appStore.currentUser?.avatar || ''" :text="appStore.currentUser?.nickname || '我'" :size="32" />
        </view>
      </template>
      <template #actions>
        <view v-if="mobileSearchOpen" class="mobile-header-search flex-row align-center">
          <AppIcon name="search" :size="17" color="var(--color-text-muted)" />
          <input
            v-model="mobileSearchQuery"
            class="mobile-header-search-input flex-1"
            type="text"
            confirm-type="search"
            placeholder="搜索联系人..."
            placeholder-style="color: var(--color-text-muted)"
            :focus="mobileSearchFocused"
            @blur="mobileSearchFocused = false"
          />
          <view class="mobile-header-search-close" @click="closeMobileSearch">
            <AppIcon name="close" :size="16" color="var(--color-text-secondary)" />
          </view>
        </view>
        <view v-if="!mobileSearchOpen" class="header-icon-btn" @click="openMobileSearch">
          <AppIcon name="search" :size="20" color="var(--color-text-secondary)" />
        </view>
        <view v-if="!mobileSearchOpen" class="header-icon-btn" @click="selectPanel('add')">
          <AppIcon name="plus" :size="20" color="var(--color-text-secondary)" />
        </view>
      </template>
    </MobilePageHeader>

    <!-- Left list area -->
    <view class="contacts-list-pane flex-column">
      
      <!-- Contacts List -->
      <view class="list-section flex-1" v-if="isDesktop || activePanel === 'contacts'">
        <ContactList 
          :active-id="selectedContact?.id" 
          :search-query="mobileSearchQuery"
          :show-search-bar="isDesktop"
          @update:search-query="mobileSearchQuery = $event"
          @select="handleSelectContact" 
          @click-add="selectPanel('add')"
        />
      </view>

      <view class="mobile-panel flex-column flex-1" v-else>
        <view class="mobile-back-row flex-row align-center" @click="selectPanel('contacts')">
          <AppIcon name="back" :size="18" color="var(--color-text-primary)" />
          <text class="mobile-back-text">返回通讯录</text>
        </view>
        <ContactUtilityPanel :active-panel="activePanel" @select-panel="selectPanel" />
      </view>
      
    </view>
    
    <!-- Right detail area (Desktop only) -->
    <view class="contacts-detail-pane flex-1" v-if="isDesktop">
      <ContactCard v-if="activePanel === 'contacts'" :contact="selectedContact" />
      <ContactUtilityPanel v-else :active-panel="activePanel" @select-panel="selectPanel" />
    </view>
    
    <!-- Mobile Contact Card Modal (PR-14 改为 bottom-sheet) -->
    <AppDialog
      v-model:visible="showMobileCard"
      variant="bottom-sheet"
      :show-cancel="false"
      confirm-text="关闭"
    >
      <ContactCard :contact="selectedContact" />
    </AppDialog>
    
  </AppShell>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useNavigationStore } from '@/stores/navigation';
import { useContactStore } from '@/stores/contact';
import { useAppStore } from '@/stores/app';
import { useResponsiveLayout } from '@/composables/useResponsiveLayout';
import AppShell from '@/components/layout/AppShell.vue';
import MobilePageHeader from '@/components/layout/MobilePageHeader.vue';
import ContactList from '@/components/contacts/ContactList.vue';
import ContactCard from '@/components/contacts/ContactCard.vue';
import ContactUtilityPanel from '@/components/contacts/ContactUtilityPanel.vue';
import AppDialog from '@/components/common/AppDialog.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';

const navStore = useNavigationStore();
const contactStore = useContactStore();
const appStore = useAppStore();
const { isDesktop } = useResponsiveLayout();

const selectedContact = ref(null);
const showMobileCard = ref(false);
const activePanel = ref('contacts');
const mobileSearchOpen = ref(false);
const mobileSearchFocused = ref(false);
const mobileSearchQuery = ref('');

const pendingRequestsCount = computed(() => {
  return contactStore.friendRequests.filter(r => r.status === 'pending').length;
});

onMounted(() => {
  navStore.setActiveModule('contacts');
  contactStore.syncNativeContacts({ silent: true });
  contactStore.fetchNativeFriendRequests({ silent: true });
});

function handleSelectContact(contact) {
  selectedContact.value = contact;
  activePanel.value = 'contacts';
  if (!isDesktop.value) {
    showMobileCard.value = true;
  }
}

function selectPanel(panel) {
  activePanel.value = panel;
  if (panel !== 'contacts') {
    closeMobileSearch();
  }
}

function goProfile() {
  uni.showToast({ title: '个人资料入口', icon: 'none' });
}

function openMobileSearch() {
  activePanel.value = 'contacts';
  mobileSearchOpen.value = true;
  nextTick(() => {
    mobileSearchFocused.value = true;
  });
}

function closeMobileSearch() {
  mobileSearchQuery.value = '';
  mobileSearchFocused.value = false;
  mobileSearchOpen.value = false;
}

</script>

<style scoped>
.me-avatar-btn,
.header-icon-btn,
.mobile-header-search-close {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.me-avatar-btn {
  border-radius: 50%;
}

.header-icon-btn {
  border-radius: 12px;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.header-icon-btn:hover,
.header-icon-btn:active {
  background-color: var(--color-bg-hover);
}

.mobile-header-search {
  position: absolute;
  top: 10px;
  left: 64px;
  right: 16px;
  height: 44px;
  z-index: 8;
  gap: 8px;
  padding: 0 0 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background-color: var(--color-bg-base);
  box-sizing: border-box;
  transform-origin: right center;
  animation: mobileSearchStretch 0.2s ease-out both;
}

.mobile-header-search-input {
  height: 100%;
  min-width: 0;
  font-size: 14px;
  color: var(--color-text-primary);
}

.mobile-header-search-close {
  color: var(--color-text-secondary);
}

@keyframes mobileSearchStretch {
  from {
    opacity: 0;
    transform: scaleX(0.24);
  }
  to {
    opacity: 1;
    transform: scaleX(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-header-search {
    animation: none;
  }
}

.contacts-list-pane {
  width: 320px;
  height: 100%;
  border-right: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
}
@media (max-width: 768px) {
  .contacts-list-pane {
    width: 100%;
    height: calc(100% - 64px);
  }
}

.quick-entries {
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}

.quick-row {
  padding: 12px 16px;
  cursor: pointer;
  background-color: var(--color-bg-surface);
  transition: background-color 0.2s ease;
}
.quick-row:hover {
  background-color: var(--color-bg-hover);
}
.quick-row.active {
  background-color: var(--color-primary-light);
}

.gap-2 {
  gap: 8px;
}

.quick-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.badge-dot {
  width: 8px;
  height: 8px;
  background-color: var(--color-error);
  border-radius: 50%;
}

.contacts-detail-pane {
  background-color: var(--color-bg-base);
  height: 100%;
}

.list-section {
  overflow: hidden;
}

.mobile-panel {
  overflow: hidden;
  background-color: var(--color-bg-base);
}

.mobile-back-row {
  min-height: 48px;
  padding: 0 16px;
  gap: 8px;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  display: flex;
  cursor: pointer;
}

.mobile-back-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}
</style>
