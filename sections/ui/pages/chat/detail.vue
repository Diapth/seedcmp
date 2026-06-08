<template>
  <AppShell :hide-mobile-tab-bar="!isDesktop">
    <!-- Left list (for desktop workbench double pane) -->
    <view class="workbench-list flex-column" v-if="isDesktop">
      <ConversationList @select="handleSelectConversation" />
    </view>

    <!-- Middle main chat details workspace -->
    <view class="workbench-detail flex-column flex-1">

      <!-- Top Chat Header (PR-14 移动端用 MobilePageHeader) -->
      <MobilePageHeader
        v-if="!isDesktop"
        :title="activeConversation?.name || '未知会话'"
        :subtitle="activeConversationSubtitle"
        :avatar="activeConversation?.avatar"
      >
        <template #left>
          <view class="mobile-back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
        </template>
        <template #actions>
          <view class="header-icon-btn" @click="handleHeaderMoreClick">
            <AppIcon :name="activeConversation?.type === 'robot' ? 'settings' : 'more'" :size="22" color="var(--color-text-primary)" />
          </view>
        </template>
      </MobilePageHeader>

      <view class="chat-header flex-row align-center justify-between" v-else>
        <view class="header-left flex-row align-center">
          <text class="chat-title">{{ activeConversation?.name || '未知会话' }}</text>
        </view>

        <view class="header-right flex-row align-center">
          <view class="toggle-detail-btn" @click="handleHeaderMoreClick">
            <AppIcon :name="activeConversation?.type === 'robot' ? 'settings' : 'more'" :size="22" color="var(--color-text-primary)" />
          </view>
        </view>
      </view>

      <view class="chat-body-stack flex-column flex-1">
        <!-- Middle Messages scroll list -->
        <view class="chat-messages-area flex-1">
          <MessageList
            :list="messagesList"
            :is-group="activeConversation?.type === 'group'"
            :bottom-anchor-key="messageBottomAnchorKey"
            @message-contextmenu="openContextMenu"
            @member-contextmenu="openMemberContextMenu"
            @member-select="openMemberProfile"
            @message-react="handleMessageReact"
            @message-show-reaction-users="handleShowReactionUsers"
            @message-open-lightbox="handleOpenLightbox"
            @message-open-file="openFileExternally"
            @message-preview-file="openFilePreview"
          />
        </view>

        <!-- Emoji Picker (PR-10/12) -->
        <view v-if="isDesktop && emojiPickerVisible" class="emoji-anchor">
          <EmojiPicker
            :mode="emojiPickerMode"
            @select="handleEmojiSelect"
            @close="emojiPickerVisible = false"
          />
        </view>

        <!-- Bottom Input area -->
        <MessageInput
          :draft="activeConversation?.draft"
          :reply-target="replyTarget"
          :mention-members="mentionCandidates"
          :is-desktop="isDesktop"
          @send="handleSendMessage"
          @draft-change="handleDraftChange"
          @cancel-reply="replyTarget = null"
          @open-emoji="openInputEmojiPicker"
          @keyboard-change="handleKeyboardChange"
        />

        <view
          v-if="!isDesktop && (emojiPickerVisible || keyboardInset > 0)"
          class="emoji-anchor mobile-input-panel"
          :style="keyboardPanelStyle"
        >
          <EmojiPicker
            v-if="emojiPickerVisible"
            :mode="emojiPickerMode"
            @select="handleEmojiSelect"
            @close="emojiPickerVisible = false"
          />
        </view>
      </view>

    </view>

    <!-- Right Sidebar Workspace pane (Slide out) -->
    <view 
      class="workbench-right" 
      v-if="showRightPane && activeConversation && isDesktop"
      :style="{ width: rightPaneWidth + 'px' }"
    >
      <view class="resize-handle" :class="{ resizing: isResizing }" @mousedown="startResize"></view>
      <FilePreviewPanel
        v-if="previewVisible"
        :visible="previewVisible"
        :file="selectedPreviewFile"
        embedded
        @close="closeFilePreview"
        @quote-selection="handleFilePreviewQuote"
      />
      <view v-else-if="profilePaneVisible && selectedMemberAgent" class="member-profile-pane flex-column">
        <view class="profile-pane-header flex-row align-center justify-between">
          <text class="profile-pane-title">智能体资料</text>
          <view class="profile-pane-close" @click="closeMemberProfile">
            <AppIcon name="close" :size="20" color="var(--color-text-secondary)" />
          </view>
        </view>
        <AgentProfilePanel
          class="profile-pane-body flex-1"
          :agent="selectedMemberAgent"
          :member="selectedMember"
          :role-label="selectedMemberRoleLabel"
          @edit="openSelectedAgentConfig"
        />
      </view>
      <view v-else-if="profilePaneVisible && selectedMemberProfileContact" class="member-profile-pane flex-column">
        <view class="profile-pane-header flex-row align-center justify-between">
          <text class="profile-pane-title">用户资料</text>
          <view class="profile-pane-close" @click="closeMemberProfile">
            <AppIcon name="close" :size="20" color="var(--color-text-secondary)" />
          </view>
        </view>
        <view class="profile-pane-body flex-1">
          <ContactCard :contact="selectedMemberProfileContact" />
        </view>
      </view>
      <RightWorkspace
        v-else
        :conversation="activeConversation"
        @close="showRightPane = false"
        @update-conversation="updateConversationField"
        @preview-file="openFilePreview"
        @member-contextmenu="openMemberContextMenu"
        @select-member="openMemberProfile"
      />
    </view>

    <!-- Context Menu Options Overlay -->
    <MessageContextMenu
      v-model:visible="menuVisible"
      :msg="selectedMenuMsg"
      :x="menuX"
      :y="menuY"
      :is-desktop="isDesktop"
      @action="handleMenuAction"
    />

    <AppContextMenu
      v-model:visible="memberMenuVisible"
      :x="memberMenuX"
      :y="memberMenuY"
      :items="memberMenuItems"
      :is-desktop="isDesktop"
      @select="handleMemberMenuSelect"
    />

    <!-- Image Lightbox (PR-12) -->
    <ImageLightbox
      :visible="lightboxVisible"
      :images="lightboxImages"
      :initial-index="lightboxIndex"
      @close="lightboxVisible = false"
    />

    <!-- Reaction Users Popover (PR-12) -->
    <AppDialog
      v-if="reactionUsersDialog.visible"
      :visible="reactionUsersDialog.visible"
      variant="confirm"
      :show-cancel="false"
      :title="`${reactionUsersDialog.emoji} 表情成员`"
      @update:visible="(v) => reactionUsersDialog.visible = v"
    >
      <view class="reaction-users-list flex-column">
        <view
          v-for="uid in reactionUsersDialog.userIds"
          :key="uid"
          class="reaction-user-row flex-row align-center"
        >
          <AppAvatar :text="resolveName(uid)" :size="32" />
          <text class="reaction-user-name">{{ resolveName(uid) }}</text>
        </view>
      </view>
    </AppDialog>

    <AppDialog
      v-if="agentProfileDialogVisible && selectedMemberAgent"
      :visible="agentProfileDialogVisible"
      variant="bottom-sheet"
      :show-footer="false"
      title="智能体信息"
      @update:visible="(v) => agentProfileDialogVisible = v"
    >
      <AgentProfilePanel
        compact
        :agent="selectedMemberAgent"
        :member="selectedMember"
        :role-label="selectedMemberRoleLabel"
        @edit="openSelectedAgentConfig"
      />
    </AppDialog>

    <AppDialog
      v-if="profileDialogVisible"
      :visible="profileDialogVisible"
      variant="confirm"
      :show-cancel="false"
      title="用户信息"
      confirm-text="知道了"
      @update:visible="(v) => profileDialogVisible = v"
    >
      <view class="member-profile flex-column align-center">
        <AppAvatar :src="selectedMember?.avatar" :text="selectedMemberDisplayName" :size="64" />
        <text class="member-profile-name">{{ selectedMemberDisplayName }}</text>
        <text class="member-profile-meta">账号：{{ selectedMember?.id || '-' }}</text>
        <text v-if="selectedMember?.nickname && selectedMember?.remark" class="member-profile-meta">昵称：{{ selectedMember.nickname }}</text>
        <text v-if="selectedMemberRoleLabel" class="member-profile-meta">群身份：{{ selectedMemberRoleLabel }}</text>
        <text v-if="selectedMemberContact?.phone" class="member-profile-meta">手机：{{ selectedMemberContact.phone }}</text>
      </view>
    </AppDialog>

    <AppDialog
      v-if="remarkDialogVisible"
      :visible="remarkDialogVisible"
      variant="confirm"
      title="修改备注"
      confirm-text="保存"
      cancel-text="取消"
      @confirm="saveMemberRemark"
      @update:visible="(v) => remarkDialogVisible = v"
    >
      <view class="remark-editor flex-column">
        <text class="remark-label">为 {{ selectedMember?.nickname || selectedMemberDisplayName }} 设置备注</text>
        <input
          v-model="remarkDraft"
          class="remark-input"
          type="text"
          maxlength="20"
          placeholder="输入备注"
        />
      </view>
    </AppDialog>

  </AppShell>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useAppStore } from '@/stores/app';
import { useNavigationStore } from '@/stores/navigation';
import { useConversationStore } from '@/stores/conversation';
import { useMessageStore } from '@/stores/message';
import { useContactStore } from '@/stores/contact';
import { useAgentStore } from '@/stores/agent';
import { useGroupStore } from '@/stores/group';
import { useResponsiveLayout } from '@/composables/useResponsiveLayout';
import AppShell from '@/components/layout/AppShell.vue';
import MobilePageHeader from '@/components/layout/MobilePageHeader.vue';
import ConversationList from '@/components/chat/ConversationList.vue';
import MessageList from '@/components/chat/MessageList.vue';
import MessageInput from '@/components/chat/MessageInput.vue';
import RightWorkspace from '@/components/chat/RightWorkspace.vue';
import MessageContextMenu from '@/components/chat/MessageContextMenu.vue';
import FilePreviewPanel from '@/components/chat/FilePreviewPanel.vue';
import ImageLightbox from '@/components/common/ImageLightbox.vue';
import EmojiPicker from '@/components/common/EmojiPicker.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppDialog from '@/components/common/AppDialog.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppContextMenu from '@/components/common/AppContextMenu.vue';
import ContactCard from '@/components/contacts/ContactCard.vue';
import AgentProfilePanel from '@/components/agents/AgentProfilePanel.vue';
import {
  isClowderConversation,
  isSelfSender,
  resolveSelfAvatar,
  resolveSelfId,
  resolveSelfName
} from '@/services/native-im/message-state';

const { isDesktop } = useResponsiveLayout();
const convStore = useConversationStore();
const messageStore = useMessageStore();
const appStore = useAppStore();
const navStore = useNavigationStore();
const contactStore = useContactStore();
const agentStore = useAgentStore();
const groupStore = useGroupStore();

const selfReactionId = computed(() => resolveSelfId(appStore.currentUser || {}));

function isSelfMemberId(id) {
  return isSelfSender(id, appStore.currentUser || {});
}

const showRightPane = ref(false);

// Context Menu states
const menuVisible = ref(false);
const selectedMenuMsg = ref(null);
const menuX = ref(0);
const menuY = ref(0);

// File Preview states
const previewVisible = ref(false);
const selectedPreviewFile = ref(null);
const profilePaneVisible = ref(false);

const rightPaneWidth = ref(420); // 默认增大一些至 420px，支持自由拖动
const isResizing = ref(false);

function startResize(e) {
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = rightPaneWidth.value;

  function doResize(moveEvent) {
    if (!isResizing.value) return;
    const deltaX = startX - moveEvent.clientX;
    const newWidth = startWidth + deltaX;
    if (newWidth >= 320 && newWidth <= 800) {
      rightPaneWidth.value = newWidth;
    }
  }

  function stopResize() {
    isResizing.value = false;
    window.removeEventListener('mousemove', doResize);
    window.removeEventListener('mouseup', stopResize);
  }

  window.addEventListener('mousemove', doResize);
  window.addEventListener('mouseup', stopResize);
}

// Lightbox (PR-12)
const lightboxVisible = ref(false);
const lightboxImages = ref([]);
const lightboxIndex = ref(0);

// Emoji Picker (PR-12)
const emojiPickerVisible = ref(false);
const emojiPickerMode = ref('input');

// Reply Target (PR-10)
const replyTarget = ref(null);

// Reaction Users Dialog (PR-12)
const reactionUsersDialog = ref({ visible: false, emoji: '', userIds: [] });
const memberMenuVisible = ref(false);
const memberMenuX = ref(0);
const memberMenuY = ref(0);
const selectedMember = ref(null);
const memberLongPressGuard = ref({ memberId: '', until: 0 });
const profileDialogVisible = ref(false);
const agentProfileDialogVisible = ref(false);
const remarkDialogVisible = ref(false);
const remarkDraft = ref('');
const keyboardInset = ref(0);
const keyboardPanelHeight = ref(280);

const activeConversation = computed(() => {
  return convStore.conversations.find((c) => c.id === convStore.activeId) || null;
});

const messagesList = computed(() => {
  if (!convStore.activeId) return [];
  return messageStore.messages[convStore.activeId] || [];
});

const activeConversationSubtitle = computed(() => {
  const conv = activeConversation.value;
  if (!conv) return '';
  if (conv.type === 'group') {
    const count = convStore.groupMembers(conv.id).length || conv.memberCount || 0;
    return `${count} 位成员`;
  }
  if (conv.type === 'robot') return '智能体会话';
  return '单聊会话';
});

// @ mention 候选 (PR-13): 群聊时取群成员, 单聊时取空
const mentionCandidates = computed(() => {
  if (!activeConversation.value) return [];
  if (activeConversation.value.type !== 'group') return [];
  return convStore.groupMembers(activeConversation.value.id);
});

const selectedMemberContact = computed(() => {
  if (!selectedMember.value?.id) return null;
  return contactStore.contacts.find((item) => item.id === selectedMember.value.id) || null;
});

const selectedMemberDisplayName = computed(() => {
  return selectedMember.value?.remark
    || selectedMemberContact.value?.remark
    || selectedMember.value?.nickname
    || selectedMember.value?.name
    || '用户';
});

const selectedMemberRoleLabel = computed(() => {
  const role = selectedMember.value?.role;
  if (role === 'owner') return '群主';
  if (role === 'admin') return '管理员';
  if (role === 'member') return '成员';
  return '';
});

const selectedMemberProfileContact = computed(() => {
  return buildMemberContact(selectedMember.value);
});

const selectedMemberAgent = computed(() => {
  return resolveAgentForMember(selectedMember.value);
});

const keyboardPanelStyle = computed(() => {
  const height = `${keyboardPanelHeight.value}px`;
  return {
    height,
    maxHeight: height
  };
});

const messageBottomAnchorKey = computed(() => {
  if (isDesktop.value) return '';
  return `${emojiPickerVisible.value ? 'emoji' : 'keyboard'}:${keyboardInset.value}:${keyboardPanelHeight.value}`;
});

const memberMenuItems = computed(() => {
  if (!selectedMember.value) return [];
  const isSelf = isSelfMemberId(selectedMember.value.id);
  const isGroup = activeConversation.value?.type === 'group';
  if (!isGroup || isSelf) return [];
  return [{ label: '@ 他', icon: 'at', action: 'mention' }];
});

onMounted(() => {
  navStore.setActiveModule('chat');
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const id = currentPage?.$page?.options?.id || '1';
  const atMemberId = currentPage?.$page?.options?.at;
  convStore.setActiveId(id);
  syncActiveMessages({ silent: true });
  appStore.bootstrapNativeSession();
  groupStore.syncNativeGroups({ silent: true });

  // Restore persisted draft
  const persistedDraft = uni.getStorageSync(`draft:${id}`);
  if (persistedDraft && !convStore.conversations.find((c) => c.id === id)?.draft) {
    convStore.updateConversationDraft(id, persistedDraft);
  }

  // 移动端长按群成员跳入 chat: query.at=memberId -> 自动 @ 成员
  if (atMemberId && activeConversation.value?.type === 'group') {
    const member = convStore.groupMembers(activeConversation.value.id).find((m) => m.id === atMemberId);
    if (member) {
      // 通过 draft 注入 @昵称 占位
      const cur = convStore.conversations.find((c) => c.id === id)?.draft || '';
      convStore.updateConversationDraft(id, cur ? `${cur}@${member.nickname} ` : `@${member.nickname} `);
    }
  }

  if (isDesktop.value) {
    showRightPane.value = true;
  }
});

onBeforeUnmount(() => {
  if (convStore.activeId) {
    const conv = convStore.conversations.find((c) => c.id === convStore.activeId);
    if (conv?.draft) {
      uni.setStorageSync(`draft:${convStore.activeId}`, conv.draft);
    } else {
      uni.removeStorageSync(`draft:${convStore.activeId}`);
    }
  }
});

function goBack() {
  uni.redirectTo({ url: '/pages/chat/index' });
}

function handleHeaderMoreClick() {
  if (!activeConversation.value) return;
  if (activeConversation.value.type === 'robot') {
    openAgentConfigFromConversation(activeConversation.value);
    return;
  }
  if (!isDesktop.value && activeConversation.value.type === 'group') {
    uni.navigateTo({ url: `/pages/group/info?id=${encodeURIComponent(activeConversation.value.id)}` });
    return;
  }
  if (!isDesktop.value && activeConversation.value.type === 'single') {
    navigateToConversationProfile(activeConversation.value);
    return;
  }
  if (!isDesktop.value) {
    uni.showToast({ title: '会话详情暂未开放', icon: 'none' });
    return;
  }
  showRightPane.value = !showRightPane.value;
}

function openAgentConfigFromConversation(conversation) {
  const agent = resolveAgentForConversation(conversation);
  if (!agent) {
    uni.showToast({ title: '未找到智能体配置', icon: 'none' });
    return;
  }
  uni.navigateTo({
    url: `/pages/agents/new?id=${encodeURIComponent(agent.id)}`
  });
}

function resolveAgentForConversation(conversation) {
  if (!conversation || conversation.type !== 'robot') return null;
  return agentStore.agents.find(agent => agent.id === conversation.id)
    || agentStore.agents.find(agent => normalizeAgentName(conversation.name).includes(normalizeAgentName(agent.name))
      || normalizeAgentName(agent.name).includes(normalizeAgentName(conversation.name)));
}

function resolveAgentForMember(member) {
  if (!member || isSelfMemberId(member.id)) return null;
  const direct = agentStore.agents.find(agent => agent.id === member.id);
  if (direct) return direct;

  const memberName = normalizeAgentName(member.nickname || member.name || '');
  if (!memberName) return null;
  return agentStore.agents.find((agent) => {
    const agentName = normalizeAgentName(agent.name);
    const agentAlias = normalizeAgentName(agent.alias || '');
    return (agentName && (memberName.includes(agentName) || agentName.includes(memberName)))
      || (agentAlias && (memberName.includes(agentAlias) || agentAlias.includes(memberName)));
  }) || null;
}

function normalizeAgentName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/@/g, '')
    .replace(/\s+/g, '')
    .replace(/智能体|ai/g, '');
}

function navigateToConversationProfile(conversation) {
  const contact = contactStore.contacts.find((item) => item.id === conversation.id);
  const params = [
    `id=${encodeURIComponent(conversation.id)}`,
    `nickname=${encodeURIComponent(contact?.nickname || conversation.name || '')}`,
    `remark=${encodeURIComponent(contact?.remark || '')}`,
    `avatar=${encodeURIComponent(contact?.avatar || conversation.avatar || '')}`,
    `status=${encodeURIComponent(contact?.status || '')}`
  ].join('&');
  uni.navigateTo({ url: `/pages/profile/index?${params}` });
}

function handleSelectConversation(id) {
  convStore.setActiveId(id);
  syncActiveMessages({ silent: true });
  closeFilePreview();
  closeMemberProfile();
}

async function syncActiveMessages(options = {}) {
  const conv = activeConversation.value;
  if (!conv) return;
  if (conv.type === 'group') {
    groupStore.syncNativeGroupMembers(conv.id, { silent: true });
  }
  try {
    await messageStore.syncNativeMessages(conv, options);
  } catch {
    // keep local demo data visible when no native backend is configured
  }
}

async function handleSendMessage({ type, content, fileName, fileSize, fileSizeBytes, replyRef, previewContent, fileType, mimeType, path, file, url }) {
  const conversation = activeConversation.value;
  const sender = {
    id: appStore.currentUser?.id || 'me',
    name: appStore.currentUser?.nickname || '我'
  };

  // 解析 mentions: 从当前 text 提取 @昵称 -> 对应 groupMembers
  const extra = {};
  if (type === 'text' && activeConversation.value?.type === 'group') {
    const members = convStore.groupMembers(activeConversation.value.id);
    const mentions = [];
    let cursor = 0;
    while (cursor < content.length) {
      const atIdx = content.indexOf('@', cursor);
      if (atIdx === -1) break;
      // 找下一个空格或末尾
      const rest = content.slice(atIdx + 1);
      const match = rest.match(/^([^\s@]+)/);
      if (!match) break;
      const name = match[1];
      const m = members.find((mm) => mm.nickname === name);
      if (m) {
        mentions.push({ userId: m.id, name, offset: atIdx });
        cursor = atIdx + 1 + name.length;
      } else {
        cursor = atIdx + 1;
      }
    }
    if (mentions.length) extra.mentions = mentions;
  }
  if (replyRef) extra.replyRef = replyRef;

  const sendPromise = messageStore.sendNativeMessage(conversation || convStore.activeId, {
    type,
    content,
    fileName,
    fileSize,
    fileSizeBytes,
    replyRef,
    previewContent,
    fileType,
    mimeType,
    path,
    file,
    url,
    mentions: extra.mentions || []
  }, sender);
  if (type === 'text' && isClowderConversation(conversation)) {
    messageStore.startClowderMarkdownStream(conversation.id, content);
  }
  await sendPromise;
  replyTarget.value = null;
}

function handleDraftChange(draftVal) {
  convStore.updateConversationDraft(convStore.activeId, draftVal);
}

function updateConversationField(fields) {
  const conv = activeConversation.value;
  if (!conv) return;
  convStore.updateNativeConversationSettings(conv, fields).catch((error) => {
    uni.showToast({ title: error?.msg || error?.message || '设置失败', icon: 'none' });
  });
}

function openContextMenu({ event, msg }) {
  const touch = event?.touches?.[0] || event?.changedTouches?.[0];
  selectedMenuMsg.value = msg;
  menuX.value = touch?.clientX || event?.clientX || 160;
  menuY.value = touch?.clientY || event?.clientY || 300;
  menuVisible.value = true;
}

function handleMenuAction({ action, msg, emoji }) {
  if (action === 'react-emoji') {
    messageStore.reactMessage(convStore.activeId, msg.id, emoji, selfReactionId.value);
  } else if (action === 'delete') {
    messageStore.deleteMessage(convStore.activeId, msg.id);
  } else if (action === 'revoke') {
    // 权限检查: 仅自己消息
    if (!isSelfSender(msg.senderId, appStore.currentUser || {})) return;
    messageStore.revokeMessage(convStore.activeId, msg.id);
  } else if (action === 'reply') {
    replyTarget.value = {
      id: msg.id,
      senderName: msg.senderName,
      contentPreview: (msg.content || '').slice(0, 60)
    };
  } else if (action === 'react') {
    emojiPickerMode.value = 'reaction';
    emojiPickerVisible.value = true;
    selectedMenuMsg.value = msg;
  }
}

function handleFilePreviewQuote(payload) {
  replyTarget.value = {
    id: payload?.id || `file-selection-${Date.now()}`,
    senderName: payload?.senderName || payload?.fileName || '文件片段',
    contentPreview: payload?.contentPreview || ''
  };
}

function handleEmojiSelect(emoji) {
  if (emojiPickerMode.value === 'reaction' && selectedMenuMsg.value) {
    messageStore.reactMessage(convStore.activeId, selectedMenuMsg.value.id, emoji, selfReactionId.value);
    emojiPickerVisible.value = false;
    return;
  }

  appendToDraft(emoji);
}

function openFilePreview(file) {
  if (!isDesktop.value) {
    uni.navigateTo({ url: `/pages/files/preview?file=${encodePreviewFile(file)}` });
    return;
  }
  selectedPreviewFile.value = file;
  previewVisible.value = true;
  profilePaneVisible.value = false;
  agentProfileDialogVisible.value = false;
  showRightPane.value = true;
}

function closeFilePreview() {
  previewVisible.value = false;
  selectedPreviewFile.value = null;
}

function openFileExternally(file) {
  const name = file?.fileName || file?.name || file?.content || '文件';
  if (isArchiveFile(name)) {
    uni.showToast({ title: '压缩包已开始下载', icon: 'none' });
    return;
  }

  // #ifdef H5
  const targetUrl = file?.url || file?.sourceUrl || file?.contentUrl;
  if (targetUrl && typeof window !== 'undefined') {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  // #endif

  uni.showToast({ title: '已请求查看文件', icon: 'none' });
}

function isArchiveFile(name) {
  return /\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(String(name || ''));
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

function resolveName(uid) {
  if (isSelfMemberId(uid)) return resolveSelfName(appStore.currentUser || {});
  const conv = activeConversation.value;
  if (conv?.type === 'group') {
    const m = convStore.groupMembers(conv.id).find((mm) => mm.id === uid);
    if (m) return m.nickname;
  }
  return uid;
}

function handleMessageReact({ msg, emoji }) {
  messageStore.reactMessage(convStore.activeId, msg.id, emoji, selfReactionId.value);
}

function handleShowReactionUsers({ msg, emoji }) {
  const r = (msg.reactions || []).find((rr) => rr.emoji === emoji);
  if (!r) return;
  reactionUsersDialog.value = {
    visible: true,
    emoji,
    userIds: r.userIds
  };
}

function handleOpenLightbox({ images, index }) {
  lightboxImages.value = images;
  lightboxIndex.value = index;
  lightboxVisible.value = true;
}

function openInputEmojiPicker() {
  selectedMenuMsg.value = null;
  emojiPickerMode.value = 'input';
  keyboardInset.value = 0;
  emojiPickerVisible.value = !emojiPickerVisible.value;
}

function handleKeyboardChange({ height = 0, focused = false } = {}) {
  if (isDesktop.value) return;
  const nextHeight = Math.max(0, Math.min(Number(height) || 0, 360));
  keyboardInset.value = nextHeight;
  if (nextHeight > 0) {
    keyboardPanelHeight.value = nextHeight;
  }
  if (focused && nextHeight > 0) {
    emojiPickerVisible.value = false;
  }
}

function appendToDraft(text) {
  if (!activeConversation.value) return;
  const current = activeConversation.value.draft || '';
  convStore.updateConversationDraft(activeConversation.value.id, `${current}${text}`);
}

function openMemberContextMenu({ event, member }) {
  const touch = event?.touches?.[0] || event?.changedTouches?.[0];
  const normalizedMember = normalizeMember(member);
  const canMention = activeConversation.value?.type === 'group' && normalizedMember && !isSelfMemberId(normalizedMember.id);

  if (!canMention) return;

  if (!isDesktop.value) {
    if (!startMemberLongPressGuard(normalizedMember)) return;
    showRightPane.value = false;
    insertMention(normalizedMember);
    return;
  }

  selectedMember.value = normalizedMember;
  memberMenuX.value = touch?.clientX || event?.clientX || 200;
  memberMenuY.value = touch?.clientY || event?.clientY || 240;
  memberMenuVisible.value = true;
}

function normalizeMember(member) {
  if (!member) return null;
  if (isSelfMemberId(member.id)) {
    return {
      ...member,
      id: resolveSelfId(appStore.currentUser || {}),
      nickname: resolveSelfName(appStore.currentUser || {}),
      avatar: resolveSelfAvatar(appStore.currentUser || {}) || member.avatar || '',
      role: member.role || 'member'
    };
  }

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

function openMemberProfile(payload) {
  const member = normalizeMember(payload?.member || payload);
  if (!member) return;

  if (shouldSuppressMemberProfile(member)) return;

  selectedMember.value = member;
  memberMenuVisible.value = false;

  if (!isDesktop.value) {
    showRightPane.value = false;
    if (resolveAgentForMember(member)) {
      profileDialogVisible.value = false;
      agentProfileDialogVisible.value = true;
      return;
    }
    agentProfileDialogVisible.value = false;
    navigateToMemberProfile(member);
    return;
  }

  agentProfileDialogVisible.value = false;
  closeFilePreview();
  profilePaneVisible.value = true;
  showRightPane.value = true;
}

function closeMemberProfile() {
  profilePaneVisible.value = false;
  agentProfileDialogVisible.value = false;
}

function startMemberLongPressGuard(member) {
  const now = Date.now();
  const currentGuard = memberLongPressGuard.value;
  if (currentGuard.memberId === member.id && now < currentGuard.until) {
    return false;
  }
  memberLongPressGuard.value = {
    memberId: member.id,
    until: now + 3000
  };
  return true;
}

function shouldSuppressMemberProfile(member) {
  const guard = memberLongPressGuard.value;
  return !isDesktop.value && guard.memberId === member.id && Date.now() < guard.until;
}

function navigateToMemberProfile(member) {
  if (isSelfMemberId(member.id)) {
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

function openSelectedAgentConfig() {
  const agent = selectedMemberAgent.value;
  if (!agent) {
    uni.showToast({ title: '未找到智能体配置', icon: 'none' });
    return;
  }
  agentProfileDialogVisible.value = false;
  uni.navigateTo({
    url: `/pages/agents/new?id=${encodeURIComponent(agent.id)}`
  });
}

function buildMemberContact(member) {
  if (!member) return null;

  if (isSelfMemberId(member.id)) {
    const currentUser = appStore.currentUser || {};
    return {
      id: resolveSelfId(currentUser),
      nickname: resolveSelfName(currentUser, member.nickname || '我'),
      avatar: resolveSelfAvatar(currentUser) || member.avatar || '',
      phone: currentUser.phone || '13800000000',
      pinyin: 'me',
      remark: '',
      status: 'online'
    };
  }

  const contact = contactStore.contacts.find((item) => item.id === member.id);
  return {
    id: member.id,
    nickname: member.nickname || member.name || contact?.nickname || '用户',
    avatar: member.avatar || contact?.avatar || '',
    phone: contact?.phone || '',
    pinyin: contact?.pinyin || member.nickname || member.name || '',
    remark: member.remark || contact?.remark || '',
    status: member.status || contact?.status || 'offline',
    group: contact?.group || '同事'
  };
}

function handleMemberMenuSelect(item) {
  if (!selectedMember.value) return;
  if (item.action === 'mention') {
    insertMention(selectedMember.value);
  } else if (item.action === 'profile') {
    openMemberProfile(selectedMember.value);
  } else if (item.action === 'remark') {
    remarkDraft.value = selectedMember.value.remark || selectedMemberContact.value?.remark || '';
    remarkDialogVisible.value = true;
  } else if (item.action === 'chat') {
    startDirectChat(selectedMember.value);
  }
}

function insertMention(member) {
  if (!activeConversation.value || activeConversation.value.type !== 'group') return;
  const name = member.nickname || member.name;
  const current = activeConversation.value.draft || '';
  const prefix = current && !current.endsWith(' ') ? ' ' : '';
  convStore.updateConversationDraft(activeConversation.value.id, `${current}${prefix}@${name} `);
  uni.showToast({ title: `已 @${name}`, icon: 'none' });
}

function saveMemberRemark() {
  if (!selectedMember.value) return;
  const remark = remarkDraft.value.trim();
  if (!isSelfMemberId(selectedMember.value.id)) {
    contactStore.upsertContactFromMember(selectedMember.value, remark);
    if (activeConversation.value?.type === 'group') {
      convStore.updateMemberRemark(activeConversation.value.id, selectedMember.value.id, remark);
    }
    selectedMember.value = { ...selectedMember.value, remark };
  }
  remarkDialogVisible.value = false;
  uni.showToast({ title: '备注已更新', icon: 'success' });
}

function startDirectChat(member) {
  const conv = convStore.upsertDirectConversation(member);
  if (!conv) return;
  convStore.setActiveId(conv.id);
  uni.setStorageSync('active_conversation_id', conv.id);
  if (!isDesktop.value) {
    uni.redirectTo({ url: `/pages/chat/detail?id=${conv.id}` });
  }
  uni.showToast({ title: `已切换到 ${conv.name}`, icon: 'none' });
}
</script>

<style scoped>
.workbench-list {
  border-right: 1px solid var(--color-border);
  height: 100%;
  min-height: 0;
  width: 320px;
  overflow: hidden;
}
@media (max-width: 768px) {
  .workbench-list {
    display: none;
  }
}

.workbench-detail {
  position: relative;
  background-color: var(--color-bg-base);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.chat-body-stack {
  position: relative;
  min-height: 0;
}

.chat-header {
  height: 56px;
  padding: 0 20px;
  background-color: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
}

.chat-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.mobile-back-btn {
  margin-right: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.toggle-detail-btn {
  cursor: pointer;
  display: flex;
  align-items: center;
  width: 44px;
  height: 44px;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}
.toggle-detail-btn:hover {
  background-color: var(--color-bg-hover);
}

.chat-messages-area {
  overflow: hidden;
  position: relative;
  min-height: 0;
}

.workbench-right {
  position: relative;
  height: 100%;
  flex-shrink: 0;
  min-width: 320px;
  display: flex;
  flex-direction: column;
}

.member-profile-pane {
  width: 100%;
  height: 100%;
  min-height: 0;
  background-color: var(--color-bg-surface);
}

.profile-pane-header {
  min-height: 56px;
  padding: 0 18px;
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
  flex-shrink: 0;
}

.profile-pane-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.profile-pane-close {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.profile-pane-close:hover,
.profile-pane-close:active {
  background-color: var(--color-bg-hover);
}

.profile-pane-body {
  min-height: 0;
  overflow: hidden;
}

.resize-handle {
  position: absolute;
  top: 0;
  left: -2px;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 1000;
  background-color: transparent;
  transition: background-color 0.2s ease;
}

.resize-handle:hover,
.resize-handle.resizing {
  background-color: rgba(0, 145, 255, 0.24);
}
@media (max-width: 768px) {
  .workbench-right {
    position: fixed;
    top: 56px;
    right: 0;
    width: 100%;
    height: calc(100vh - 56px);
    z-index: 100;
    box-shadow: -4px 0 10px rgba(0,0,0,0.1);
  }
}

.emoji-anchor {
  position: absolute;
  bottom: 84px;
  left: 16px;
  z-index: 100;
  display: flex;
  padding: 0;
  background-color: transparent;
  border-top: none;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .chat-body-stack {
    overflow: visible;
    transition: none;
  }

  .emoji-anchor {
    position: static;
    left: auto;
    bottom: auto;
    z-index: auto;
    width: 100%;
    padding: 0;
    background-color: var(--color-bg-surface);
    border-top: 1px solid var(--color-border);
  }

  .mobile-input-panel {
    height: 280px;
    max-height: 280px;
    flex-shrink: 0;
    overflow: hidden;
    box-shadow: 0 -1px 4px rgba(15, 23, 42, 0.05);
  }

  .mobile-input-panel :deep(.emoji-picker-container) {
    width: 100%;
    height: 100%;
    max-height: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  .mobile-input-panel :deep(.emoji-scroll) {
    height: 100%;
  }
}

.reaction-users-list {
  gap: 8px;
  padding: 4px 0;
}

.reaction-user-row {
  gap: 10px;
  padding: 4px 0;
  display: flex;
  align-items: center;
}

.reaction-user-name {
  font-size: 14px;
  color: var(--color-text-primary);
}

.member-profile {
  gap: 8px;
  padding: 4px 0;
}

.member-profile-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.member-profile-meta {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.remark-editor {
  gap: 10px;
}

.remark-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.remark-input {
  height: 42px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  background-color: var(--color-bg-base);
  box-sizing: border-box;
}
</style>
