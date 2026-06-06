<template>
  <AppShell :hide-mobile-tab-bar="true" :hide-desktop-sidebar="true">
    <view class="group-info-page flex-column flex-1">
      <MobilePageHeader
        :title="conversation?.name || '群聊信息'"
        :subtitle="groupSubtitle"
        :avatar="conversation?.avatar"
      >
        <template #left>
          <view class="back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
        </template>
      </MobilePageHeader>

      <scroll-view scroll-y class="group-info-scroll flex-1">
        <GroupInfoPanel
          v-if="groupData"
          :group="groupData"
          @open-members="openMembers"
          @open-qrcode="openQrcode"
          @open-board="openBoard"
          @preview-file="openFilePreview"
          @select-member="openMemberProfile"
          @member-contextmenu="handleMemberLongPress"
        />
        <view v-else class="empty-state flex-column align-center justify-center">
          <text class="empty-title">未找到群聊</text>
          <text class="empty-desc">请返回聊天列表重新进入</text>
        </view>
      </scroll-view>
    </view>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useConversationStore } from '@/stores/conversation';
import { useGroupStore } from '@/stores/group';
import { useContactStore } from '@/stores/contact';
import { useNavigationStore } from '@/stores/navigation';
import AppShell from '@/components/layout/AppShell.vue';
import MobilePageHeader from '@/components/layout/MobilePageHeader.vue';
import GroupInfoPanel from '@/components/chat/GroupInfoPanel.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const convStore = useConversationStore();
const groupStore = useGroupStore();
const contactStore = useContactStore();
const navStore = useNavigationStore();
const routeOptions = ref({});
const memberTapGuard = ref({ memberId: '', until: 0 });

const groupId = computed(() => readOption('id') || convStore.activeId || '2');

const conversation = computed(() => {
  return convStore.conversations.find((item) => item.id === groupId.value) || null;
});

const groupData = computed(() => {
  const group = groupStore.groups.find((item) => item.id === groupId.value);
  if (group) return group;
  if (!conversation.value) return null;
  return {
    id: conversation.value.id,
    name: conversation.value.name,
    avatar: conversation.value.avatar,
    memberCount: conversation.value.memberCount || convStore.groupMembers(conversation.value.id).length,
    announcement: '',
    creatorId: 'me',
    createTime: 0
  };
});

const groupSubtitle = computed(() => {
  const count = convStore.groupMembers(groupId.value).length || groupData.value?.memberCount || 0;
  return count ? `${count} 位成员` : '';
});

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  routeOptions.value = currentPage?.$page?.options || {};
  if (groupId.value) {
    convStore.setActiveId(groupId.value);
    groupStore.setActiveGroupId(groupId.value);
  }
  navStore.setActiveModule('chat');
});

function readOption(key) {
  const value = routeOptions.value?.[key];
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function goBack() {
  uni.navigateBack({
    fail: () => uni.redirectTo({ url: `/pages/chat/detail?id=${encodeURIComponent(groupId.value)}` })
  });
}

function openMembers() {
  uni.navigateTo({ url: `/pages/group/members?id=${encodeURIComponent(groupId.value)}` });
}

function openQrcode() {
  uni.navigateTo({ url: `/pages/group/qrcode?id=${encodeURIComponent(groupId.value)}` });
}

function openBoard() {
  uni.navigateTo({ url: `/pages/agents/board?groupId=${encodeURIComponent(groupId.value)}` });
}

function openFilePreview(file) {
  uni.navigateTo({ url: `/pages/files/preview?file=${encodePreviewFile(file)}` });
}

function openMemberProfile(member) {
  const normalized = normalizeMember(member);
  if (!normalized || shouldSuppressMemberProfile(normalized)) return;
  navigateToMemberProfile(normalized);
}

function handleMemberLongPress({ member }) {
  const normalized = normalizeMember(member);
  if (!normalized || normalized.id === 'me') return;
  memberTapGuard.value = {
    memberId: normalized.id,
    until: Date.now() + 3000
  };
  uni.redirectTo({
    url: `/pages/chat/detail?id=${encodeURIComponent(groupId.value)}&at=${encodeURIComponent(normalized.id)}`
  });
}

function shouldSuppressMemberProfile(member) {
  const guard = memberTapGuard.value;
  return guard.memberId === member.id && Date.now() < guard.until;
}

function normalizeMember(member) {
  if (!member) return null;
  const contact = contactStore.contacts.find((item) => item.id === member.id);
  return {
    id: member.id,
    nickname: member.nickname || member.name || contact?.nickname || '用户',
    avatar: member.avatar || contact?.avatar || '',
    remark: member.remark || contact?.remark || '',
    role: member.role || 'member',
    status: member.status || contact?.status || 'offline'
  };
}

function navigateToMemberProfile(member) {
  if (member.id === 'me') {
    uni.navigateTo({ url: '/pages/profile/index' });
    return;
  }
  const params = [
    `id=${encodeURIComponent(member.id)}`,
    `nickname=${encodeURIComponent(member.nickname || member.name || '')}`,
    `remark=${encodeURIComponent(member.remark || '')}`,
    `avatar=${encodeURIComponent(member.avatar || '')}`,
    `status=${encodeURIComponent(member.status || '')}`,
    `role=${encodeURIComponent(member.role || '')}`
  ].join('&');
  uni.navigateTo({ url: `/pages/profile/index?${params}` });
}

function encodePreviewFile(file) {
  const payload = {
    id: file?.id || '',
    name: file?.name || file?.fileName || file?.content || '',
    fileName: file?.fileName || file?.name || file?.content || '',
    content: file?.content || '',
    fileSize: file?.fileSize || file?.size || '',
    size: file?.size || file?.fileSize || '',
    fileType: file?.fileType || file?.ext || '',
    ext: file?.ext || file?.fileType || '',
    url: file?.url || '',
    sourceUrl: file?.sourceUrl || '',
    contentUrl: file?.contentUrl || '',
    previewContent: file?.previewContent || file?.contentText || file?.markdown || file?.text || '',
    contentText: file?.contentText || '',
    markdown: file?.markdown || '',
    text: file?.text || ''
  };
  return encodeURIComponent(JSON.stringify(payload));
}
</script>

<style scoped>
.group-info-page {
  height: 100%;
  background-color: var(--color-bg-base);
  overflow: hidden;
}

.back-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:active {
  background-color: var(--color-bg-hover);
}

.group-info-scroll {
  min-height: 0;
  height: 0;
}

.group-info-scroll :deep(.group-info) {
  min-height: 100%;
  padding-bottom: calc(28px + env(safe-area-inset-bottom));
}

.empty-state {
  min-height: 60vh;
  gap: 8px;
  padding: 24px;
  box-sizing: border-box;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.empty-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
}

@media (min-width: 769px) {
  .group-info-page {
    max-width: 560px;
    margin: 0 auto;
    border-left: 1px solid var(--color-border);
    border-right: 1px solid var(--color-border);
  }
}
</style>
