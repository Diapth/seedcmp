<template>
  <view class="contact-utility-panel flex-column">
    <view class="panel-header flex-row align-center justify-between">
      <view class="header-main flex-row align-center">
        <view class="header-icon">
          <AppIcon :name="panelMeta.icon" :size="20" color="var(--color-primary)" />
        </view>
        <view class="header-text flex-column">
          <text class="panel-title">{{ panelMeta.title }}</text>
          <text class="panel-subtitle">{{ panelMeta.subtitle }}</text>
        </view>
      </view>
      <text class="panel-count" v-if="panelMeta.count">{{ panelMeta.count }}</text>
    </view>

    <scroll-view scroll-y class="panel-scroll flex-1">
      <view class="panel-body" v-if="activePanel === 'requests'">
        <view class="request-list flex-column" v-if="contactStore.friendRequests.length > 0">
          <view
            v-for="req in contactStore.friendRequests"
            :key="req.id"
            class="request-row flex-row align-center justify-between"
          >
            <view class="request-left flex-row align-center">
              <AppAvatar :src="''" :text="req.nickname" :size="44" />
              <view class="request-meta flex-column">
                <text class="request-name">{{ req.nickname }}</text>
                <text class="request-message">{{ req.message }}</text>
              </view>
            </view>

            <view class="request-actions flex-row align-center">
              <template v-if="req.status === 'pending'">
                <button class="btn-secondary" @click="handleReject(req.id)">拒绝</button>
                <button class="btn-primary" @click="handleAccept(req.id)">同意</button>
              </template>
              <text class="status-text accepted" v-else-if="req.status === 'accepted'">已同意</text>
              <text class="status-text rejected" v-else>已拒绝</text>
            </view>
          </view>
        </view>

        <view class="empty-panel" v-else>
          <AppEmptyState icon="user" title="没有新的好友申请" description="新的联系人申请会显示在这里" />
        </view>
      </view>

      <view class="panel-body" v-else-if="activePanel === 'add'">
        <view class="search-card flex-column">
          <text class="field-label">搜索好友</text>
          <view class="search-bar flex-row align-center">
            <AppIcon name="search" :size="18" color="var(--color-text-muted)" />
            <input
              type="text"
              v-model="searchQuery"
              placeholder="请输入手机号 / 昵称 / ID"
              class="search-input flex-1"
              confirm-type="search"
              @confirm="handleSearch"
            />
            <button class="btn-search" @click="handleSearch">搜索</button>
          </view>
        </view>

        <view class="result-section flex-column" v-if="searchResult">
          <view class="result-card flex-row align-center">
            <AppAvatar :src="searchResult.avatar" :text="searchResult.nickname" :size="56" />
            <view class="result-meta flex-column flex-1">
              <text class="result-name">{{ searchResult.nickname }}</text>
              <text class="result-sub" v-if="searchResult.phone">手机号：{{ searchResult.phone }}</text>
              <text class="result-sub" v-else>ID：{{ searchResult.id }}</text>
            </view>
          </view>

          <view class="action-panel flex-column">
            <view class="status-tip flex-column" v-if="searchResult.relationship === 'friend'">
              <view class="tip-line flex-row align-center">
                <AppIcon name="check" :size="16" color="var(--color-success)" />
                <text class="tip-text success">已是好友，可以直接发送消息</text>
              </view>
              <button class="btn-wide-primary" @click="goChat">发送消息</button>
            </view>

            <view class="status-tip flex-column" v-else-if="searchResult.relationship === 'blacklist'">
              <view class="tip-line flex-row align-center">
                <AppIcon name="info" :size="16" color="var(--color-error)" />
                <text class="tip-text error">该用户已在黑名单中</text>
              </view>
              <button class="btn-wide-secondary" @click="unblock">移出黑名单</button>
            </view>

            <view class="status-tip flex-column" v-else-if="searchResult.relationship === 'pending_received'">
              <view class="tip-line flex-row align-center">
                <AppIcon name="info" :size="16" color="var(--color-warning)" />
                <text class="tip-text warning">对方已向您发送好友申请</text>
              </view>
              <button class="btn-wide-primary" @click="$emit('select-panel', 'requests')">去处理</button>
            </view>

            <view class="status-tip flex-column" v-else-if="searchResult.relationship === 'sent'">
              <view class="tip-line flex-row align-center">
                <AppIcon name="check" :size="16" color="var(--color-success)" />
                <text class="tip-text success">好友申请已发送</text>
              </view>
              <button class="btn-wide-secondary" @click="resetSearch">继续搜索</button>
            </view>

            <view class="add-flow flex-column" v-else>
              <view class="verification-box flex-column">
                <text class="field-label">验证消息</text>
                <textarea
                  v-model="verificationMsg"
                  placeholder="我是..."
                  class="verification-input"
                  maxlength="50"
                />
              </view>
              <button class="btn-wide-primary" :loading="sending" @click="sendRequest">发送申请</button>
            </view>
          </view>
        </view>

        <view class="empty-panel" v-else-if="searched">
          <AppEmptyState icon="search" title="未找到相关用户" description="请检查输入内容，或尝试更完整的手机号、昵称、ID" />
        </view>

        <view class="guide-panel flex-column" v-else>
          <text class="guide-title">添加联系人</text>
          <text class="guide-text">搜索手机号、昵称或 ID 后，可以发送好友验证消息。处理过程会停留在当前通讯录页面内。</text>
        </view>
      </view>

      <view class="panel-body" v-else-if="activePanel === 'blacklist'">
        <view class="blacklist-list flex-column" v-if="contactStore.blacklist.length > 0">
          <view
            v-for="item in contactStore.blacklist"
            :key="item.id"
            class="blacklist-row flex-row align-center justify-between"
          >
            <view class="blacklist-user flex-row align-center">
              <AppAvatar :src="item.avatar" :text="item.nickname" :size="42" />
              <view class="blacklist-meta flex-column">
                <text class="blacklist-name">{{ item.nickname }}</text>
                <text class="blacklist-desc">已屏蔽消息和好友申请提醒</text>
              </view>
            </view>
            <button class="btn-secondary" @click="handleRemove(item)">移出</button>
          </view>
        </view>

        <view class="empty-panel" v-else>
          <AppEmptyState icon="settings" title="黑名单为空" description="您目前没有屏蔽任何联系人" />
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useContactStore } from '@/stores/contact';
import { useConversationStore } from '@/stores/conversation';
import { useConfirm } from '@/composables/useConfirm';
import AppAvatar from '../common/AppAvatar.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import AppIcon from '../common/AppIcon.vue';

const props = defineProps({
  activePanel: {
    type: String,
    required: true
  }
});

defineEmits(['select-panel']);

const contactStore = useContactStore();
const convStore = useConversationStore();
const { confirm } = useConfirm();

const searchQuery = ref('');
const searched = ref(false);
const searchResult = ref(null);
const verificationMsg = ref('你好，我想添加你为好友');
const sending = ref(false);

const pendingCount = computed(() => {
  return contactStore.friendRequests.filter(item => item.status === 'pending').length;
});

const panelMeta = computed(() => {
  if (props.activePanel === 'requests') {
    return {
      icon: 'user',
      title: '新的朋友',
      subtitle: '处理好友申请，不离开通讯录页面',
      count: pendingCount.value ? `${pendingCount.value} 条待处理` : ''
    };
  }
  if (props.activePanel === 'add') {
    return {
      icon: 'plus',
      title: '添加朋友',
      subtitle: '搜索并发送验证消息',
      count: ''
    };
  }
  return {
    icon: 'settings',
    title: '黑名单管理',
    subtitle: '管理已屏蔽联系人',
    count: contactStore.blacklist.length ? `${contactStore.blacklist.length} 人` : ''
  };
});

function handleAccept(id) {
  contactStore.acceptRequest(id);
  uni.showToast({ title: '已添加该好友', icon: 'success' });
}

function handleReject(id) {
  contactStore.rejectRequest(id);
  uni.showToast({ title: '已拒绝申请', icon: 'none' });
}

async function handleSearch() {
  const query = searchQuery.value.trim();
  if (!query) {
    uni.showToast({ title: '请输入搜索内容', icon: 'none' });
    return;
  }

  searched.value = true;

  const friend = contactStore.contacts.find(
    item => item.nickname === query || item.phone === query || item.id === query
  );
  if (friend) {
    searchResult.value = {
      id: friend.id,
      nickname: friend.nickname,
      phone: friend.phone,
      avatar: friend.avatar,
      relationship: 'friend'
    };
    return;
  }

  const black = contactStore.blacklist.find(
    item => item.nickname === query || item.phone === query || item.id === query
  );
  if (black) {
    searchResult.value = {
      id: black.id,
      nickname: black.nickname,
      phone: black.phone || '',
      avatar: black.avatar,
      relationship: 'blacklist'
    };
    return;
  }

  const pending = contactStore.friendRequests.find(
    item => (item.nickname === query || item.id === query) && item.status === 'pending'
  );
  if (pending) {
    searchResult.value = {
      id: pending.id,
      nickname: pending.nickname,
      phone: '',
      avatar: '',
      relationship: 'pending_received'
    };
    return;
  }

  try {
    searchResult.value = await contactStore.searchUser(query);
  } catch (err) {
    searchResult.value = null;
    uni.showToast({ title: err?.message || '搜索用户失败', icon: 'none' });
  }
}

function goChat() {
  if (!searchResult.value) return;

  let conv = convStore.conversations.find(item => item.id === searchResult.value.id);
  if (!conv) {
    conv = {
      id: searchResult.value.id,
      name: searchResult.value.nickname,
      avatar: searchResult.value.avatar,
      type: 'single',
      unread: 0,
      lastMessage: '已添加您为好友，现在可以开始聊天了。',
      lastTime: Date.now(),
      isPinned: false,
      isMuted: false,
      draft: ''
    };
    convStore.conversations.push(conv);
  }

  convStore.setActiveId(searchResult.value.id);
  uni.setStorageSync('active_conversation_id', searchResult.value.id);
  uni.redirectTo({ url: '/pages/chat/index' });
}

function unblock() {
  if (!searchResult.value) return;
  contactStore.removeFromBlacklist(searchResult.value.id);
  searchResult.value.relationship = 'friend';
  uni.showToast({ title: '已移出黑名单', icon: 'success' });
}

async function sendRequest() {
  if (!searchResult.value) return;
  sending.value = true;

  try {
    await contactStore.sendFriendRequest(
      searchResult.value.id || searchResult.value.nickname,
      verificationMsg.value,
      searchResult.value.vercode
    );
    searchResult.value.relationship = 'sent';
    sending.value = false;
    uni.showToast({ title: '好友申请已发送', icon: 'success' });
  } catch (err) {
    sending.value = false;
    uni.showToast({ title: err?.message || '好友申请发送失败', icon: 'none' });
  }
}

function resetSearch() {
  searchQuery.value = '';
  searched.value = false;
  searchResult.value = null;
  verificationMsg.value = '你好，我想添加你为好友';
}

function handleRemove(item) {
  // PR-15: 替换 showModal -> useConfirm
  confirm(`确定要将 ${item.nickname} 移出黑名单吗？移出后您将恢复接收对方的消息。`, {
    title: '移出黑名单',
    destructive: true
  }).then((ok) => {
    if (ok) {
      contactStore.removeFromBlacklist(item.id);
      uni.showToast({ title: '已移出黑名单', icon: 'success' });
    }
  });
}
</script>

<style scoped>
.contact-utility-panel {
  height: 100%;
  min-width: 0;
  background-color: var(--color-bg-base);
}

.panel-header {
  min-height: 72px;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  box-sizing: border-box;
  display: flex;
}

.header-main {
  gap: 12px;
  min-width: 0;
}

.header-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background-color: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-text {
  min-width: 0;
}

.panel-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.panel-subtitle {
  margin-top: 3px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.panel-count {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 700;
  background-color: var(--color-primary-light);
  border-radius: 999px;
  padding: 4px 10px;
}

.panel-scroll {
  height: 100%;
}

.panel-body {
  padding: 20px 24px 28px;
  box-sizing: border-box;
}

.request-list,
.blacklist-list,
.result-section,
.action-panel,
.add-flow {
  gap: 12px;
}

.request-row,
.blacklist-row,
.result-card,
.search-card,
.action-panel,
.guide-panel {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-sizing: border-box;
}

.request-row,
.blacklist-row,
.result-card {
  padding: 14px 16px;
  display: flex;
}

.request-left,
.blacklist-user,
.result-card,
.tip-line {
  gap: 12px;
}

.request-meta,
.blacklist-meta,
.result-meta {
  min-width: 0;
}

.request-name,
.blacklist-name,
.result-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.request-message,
.blacklist-desc,
.result-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-actions {
  gap: 8px;
  flex-shrink: 0;
}

.btn-primary,
.btn-secondary,
.btn-search {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.btn-primary,
.btn-search,
.btn-wide-primary {
  background-color: var(--color-primary);
  color: #ffffff;
}

.btn-secondary,
.btn-wide-secondary {
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-primary::after,
.btn-secondary::after,
.btn-search::after,
.btn-wide-primary::after,
.btn-wide-secondary::after {
  border: none;
}

.status-text {
  font-size: 13px;
  font-weight: 600;
}

.accepted {
  color: var(--color-text-muted);
}

.rejected {
  color: var(--color-error);
}

.search-card,
.guide-panel {
  padding: 16px;
}

.field-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.search-bar {
  gap: 10px;
}

.search-input {
  height: 40px;
  min-width: 0;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 12px;
  box-sizing: border-box;
  font-size: 14px;
  color: var(--color-text-primary);
}

.result-section {
  margin-top: 16px;
}

.action-panel {
  padding: 16px;
  display: flex;
}

.status-tip {
  gap: 12px;
}

.tip-line {
  display: flex;
}

.tip-text {
  font-size: 13px;
  font-weight: 600;
}

.tip-text.success {
  color: var(--color-success);
}

.tip-text.error {
  color: var(--color-error);
}

.tip-text.warning {
  color: var(--color-warning);
}

.verification-box {
  gap: 8px;
}

.verification-input {
  width: 100%;
  height: 88px;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  box-sizing: border-box;
  font-size: 14px;
  color: var(--color-text-primary);
}

.btn-wide-primary,
.btn-wide-secondary {
  width: 100%;
  min-height: 44px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.guide-panel {
  gap: 8px;
  display: flex;
}

.guide-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.guide-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.empty-panel {
  padding-top: 64px;
}

@media (max-width: 768px) {
  .panel-header {
    min-height: 64px;
    padding: 0 16px;
  }

  .panel-body {
    padding: 16px;
  }

  .request-row,
  .blacklist-row {
    align-items: flex-start;
    gap: 12px;
  }

  .request-left,
  .blacklist-user {
    min-width: 0;
  }

  .request-actions {
    flex-direction: column;
  }
}
</style>
