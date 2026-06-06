<template>
  <view class="contact-card-container flex-column" v-if="contact">
    <!-- 顶部名片栏 -->
    <view class="header-card flex-row align-center justify-between">
      <view class="header-identity flex-row align-center gap-3">
        <!-- 姓名首字头像 -->
        <view class="char-avatar" :style="{ backgroundColor: getAvatarBg(contact) }">
          <text class="avatar-text">{{ contact.nickname.charAt(0) }}</text>
        </view>
        <view class="header-meta flex-column justify-center">
          <view class="name-status-row flex-row align-center gap-2">
            <text class="card-name">{{ contact.nickname }}</text>
            <!-- 在线状态胶囊 -->
            <view class="status-capsule flex-row align-center" :class="contact.status">
              <view class="status-dot-blink" :class="contact.status" />
              <text class="status-text">{{ statusText }}</text>
            </view>
          </view>
          <text class="card-remark" v-if="contact.remark">备注: {{ contact.remark }}</text>
          <text class="card-remark" v-else>备注: 无</text>
        </view>
      </view>
      <!-- 发送消息按钮 -->
      <button class="btn-send flex-row align-center justify-center gap-1" @click="startChat">
        <AppIcon name="chat" :size="16" color="#ffffff" />
        <text class="btn-text">发送消息</text>
      </button>
    </view>

    <!-- 中间详情卡片组 (3列并排) -->
    <view class="details-grid">
      <!-- 基础信息卡片 -->
      <view class="detail-card flex-column">
        <view class="card-title-row flex-row align-center gap-2">
          <AppIcon name="contacts" :size="16" color="var(--color-primary)" />
          <text class="card-title">基础信息</text>
        </view>
        <view class="card-content flex-column">
          <view class="info-row flex-row align-center justify-between">
            <view class="info-label flex-row align-center gap-2">
              <AppIcon name="phone" :size="15" color="#94a3b8" />
              <text>电话号码</text>
            </view>
            <text class="info-value">{{ contact.phone || '未填写' }}</text>
          </view>
          <view class="info-row flex-row align-center justify-between">
            <view class="info-label flex-row align-center gap-2">
              <AppIcon name="user" :size="15" color="#94a3b8" />
              <text>所属分组</text>
            </view>
            <text class="info-value">{{ contact.group || '未分组' }}</text>
          </view>
          <view class="info-row flex-row align-center justify-between">
            <view class="info-label flex-row align-center gap-2">
              <AppIcon name="wifi" :size="15" color="#94a3b8" />
              <text>在线状态</text>
            </view>
            <view class="info-value flex-row align-center gap-1">
              <view class="status-dot" :class="contact.status" />
              <text>{{ statusText }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 共同群聊卡片 -->
      <view class="detail-card flex-column">
        <view class="card-title-row flex-row align-center gap-2">
          <AppIcon name="group" :size="16" color="var(--color-primary)" />
          <text class="card-title">共同群聊</text>
        </view>
        <view class="card-content flex-column gap-2">
          <text v-if="commonGroups.length === 0" class="empty-meta-text">暂无共同群聊</text>
          <view
            v-for="group in commonGroups"
            :key="group.name"
            class="group-row-item flex-row align-center gap-3"
          >
            <view class="group-icon-avatar" :style="{ backgroundColor: group.color }">
              <AppIcon :name="group.icon" :size="14" color="#ffffff" />
            </view>
            <text class="group-name-text">{{ group.name }}</text>
          </view>
        </view>
      </view>

      <!-- 备注与标签卡片 -->
      <view class="detail-card flex-column">
        <view class="card-title-row flex-row align-center gap-2">
          <AppIcon name="bookmark" :size="16" color="var(--color-primary)" />
          <text class="card-title">备注与标签</text>
        </view>
        <view class="card-content flex-column">
          <view class="remark-section flex-row align-center justify-between">
            <text class="remark-label">备注</text>
            <text class="remark-val">{{ contact.remark || '无' }}</text>
          </view>
          <view class="tag-section flex-column gap-2">
            <text class="tag-label">标签</text>
            <view class="tag-list flex-row flex-wrap gap-1">
              <view 
                v-for="tag in defaultTags" 
                :key="tag.text"
                class="tag-badge"
                :class="tag.type"
              >
                {{ tag.text }}
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部“更多操作”卡片 -->
    <view class="more-actions-card flex-column">
      <view class="card-title-row flex-row align-center gap-2">
        <AppIcon name="settings" :size="16" color="var(--color-primary)" />
        <text class="card-title">更多操作</text>
      </view>
      <view class="actions-row flex-row align-center justify-around">
        <view class="action-btn flex-row align-center justify-center gap-2" @click="removeFriend">
          <AppIcon name="trash" :size="16" color="#ef4444" />
          <text class="action-btn-text">删除好友</text>
        </view>
        <view class="action-divider" />
        <view class="action-btn flex-row align-center justify-center gap-2" @click="blockContact">
          <AppIcon name="block" :size="16" color="#ef4444" />
          <text class="action-btn-text">加入黑名单</text>
        </view>
        <view class="action-divider" />
        <view class="action-btn flex-row align-center justify-center gap-2" @click="reportContact">
          <AppIcon name="flag" :size="16" color="#ef4444" />
          <text class="action-btn-text">举报</text>
        </view>
      </view>
    </view>
  </view>

  <view class="card-empty flex-column align-center justify-center flex-1" v-else>
    <AppEmptyState icon="user" title="请选择联系人" description="在左侧列表中点击好友以查看详细资料" />
  </view>

  <!-- 举报 action-sheet 模式 -->
  <AppDialog
    v-model:visible="reportSheetVisible"
    variant="action-sheet"
    :action-items="reportSheetItems"
  />
</template>

<script setup>
import { computed, ref } from 'vue';
import { useContactStore } from '@/stores/contact';
import { useConversationStore } from '@/stores/conversation';
import { useConfirm } from '@/composables/useConfirm';
import AppIcon from '../common/AppIcon.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import AppDialog from '../common/AppDialog.vue';

const props = defineProps({
  contact: {
    type: Object,
    default: null
  }
});

const contactStore = useContactStore();
const convStore = useConversationStore();
const { confirm } = useConfirm();

const statusText = computed(() => {
  if (!props.contact) return '';
  if (props.contact.status === 'online') return '在线';
  if (props.contact.status === 'offline') return '离线';
  if (props.contact.status === 'away') return '离开';
  return '忙碌';
});

// Show only group conversations that are already present in the real conversation store.
const commonGroups = computed(() => {
  const list = convStore.conversations.filter(c => c.type === 'group');
  return list.slice(0, 3).map((item, index) => ({
    name: item.name,
    icon: 'group',
    color: index % 3 === 0 ? '#3b82f6' : index % 3 === 1 ? '#7c3aed' : '#0d9488'
  }));
});

const defaultTags = computed(() => {
  if (!props.contact) return [];
  if (Array.isArray(props.contact.tags)) {
    return props.contact.tags.map((tag) => ({
      text: typeof tag === 'string' ? tag : tag.text,
      type: typeof tag === 'string' ? 'blue' : tag.type || 'blue'
    })).filter((tag) => tag.text);
  }
  return props.contact.group ? [{ text: props.contact.group, type: 'blue' }] : [];
});

function getAvatarBg(item) {
  if (!item || !item.nickname) return '#22c55e';
  const firstChar = item.nickname.charAt(0);
  if (firstChar === '张') return '#22c55e'; // 绿色
  if (firstChar === '李') return '#ea580c'; // 橙色
  if (firstChar === '王') return '#e11d48'; // 红色
  
  const colors = ['#22c55e', '#ea580c', '#e11d48', '#2563eb', '#7c3aed'];
  const code = (item.id && item.id.charCodeAt(0)) || 0;
  return colors[code % colors.length];
}

function startChat() {
  let conv = convStore.conversations.find((c) => c.id === props.contact.id);
  if (!conv) {
    conv = {
      id: props.contact.id,
      name: props.contact.nickname,
      avatar: props.contact.avatar,
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

  convStore.setActiveId(props.contact.id);
  uni.setStorageSync('active_conversation_id', props.contact.id);
  uni.redirectTo({ url: '/pages/chat/index' });
}

function blockContact() {
  confirm(`确定要将 ${props.contact.nickname} 加入黑名单吗？加入后将不再接收对方的消息。`, {
    title: '加入黑名单',
    destructive: true
  }).then((ok) => {
    if (ok) {
      contactStore.addToBlacklist(props.contact.id);
      uni.showToast({ title: '已加入黑名单', icon: 'success' });
    }
  });
}

function removeFriend() {
  confirm(`确定要删除 ${props.contact.nickname} 吗？删除后可通过添加朋友重新发送申请。`, {
    title: '删除好友',
    destructive: true
  }).then((ok) => {
    if (ok) {
      contactStore.contacts = contactStore.contacts.filter((item) => item.id !== props.contact.id);
      uni.showToast({ title: '已删除好友', icon: 'success' });
    }
  });
}

const reportSheetVisible = ref(false);
const reportSheetItems = [
  { label: '垃圾广告', onClick: () => uni.showToast({ title: '举报已提交', icon: 'success' }) },
  { label: '骚扰信息', onClick: () => uni.showToast({ title: '举报已提交', icon: 'success' }) },
  { label: '账号异常', onClick: () => uni.showToast({ title: '举报已提交', icon: 'success' }) }
];

function reportContact() {
  reportSheetVisible.value = true;
}
</script>

<style scoped>
.contact-card-container {
  container-type: inline-size;
  width: 100%;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
  background-color: #f8fafc;
  overflow-y: auto;
  gap: 20px;
}

/* 顶部名片栏 */
.header-card {
  width: 100%;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

.char-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
}

.header-meta {
  min-width: 0;
}

.card-name {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}

/* 在线状态胶囊 */
.status-capsule {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
}

.status-capsule.online {
  background-color: #f0fdf4;
  color: #16a34a;
}
.status-capsule.offline {
  background-color: #f1f5f9;
  color: #64748b;
}
.status-capsule.away {
  background-color: #fef9c3;
  color: #ca8a04;
}

.status-dot-blink {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.status-dot-blink.online {
  background-color: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
}
.status-dot-blink.offline {
  background-color: #94a3b8;
}
.status-dot-blink.away {
  background-color: #eab308;
  box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.2);
}

.card-remark {
  font-size: 13.5px;
  color: #64748b;
  margin-top: 6px;
}

.btn-send {
  height: 40px;
  padding: 0 20px;
  border-radius: 8px;
  background-color: #0b66e4;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  margin: 0;
  transition: all 0.2s ease;
}

.btn-send::after {
  border: none;
}

.btn-send:hover {
  background-color: #0256cc;
}

.btn-send:active {
  transform: scale(0.97);
}

.btn-text {
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
}

/* 详情网格 (Desktop: 3列, Mobile: 1列) */
.details-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  width: 100%;
}

@media (max-width: 1024px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
}

.detail-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
  min-height: 200px;
}

.card-title-row {
  margin-bottom: 20px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 10px;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}

.card-content {
  width: 100%;
}

/* 基础信息内容 */
.info-row {
  width: 100%;
  padding: 10px 0;
  border-bottom: 1px solid #f8fafc;
}
.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 13px;
  color: #64748b;
}

.info-value {
  font-size: 13px;
  color: #1e293b;
  font-weight: 500;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.status-dot.online {
  background-color: #22c55e;
}
.status-dot.offline {
  background-color: #94a3b8;
}
.status-dot.away {
  background-color: #eab308;
}

/* 共同群聊内容 */
.group-row-item {
  width: 100%;
  padding: 8px 0;
  border-bottom: 1px solid #f8fafc;
}
.group-row-item:last-child {
  border-bottom: none;
}

.group-icon-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.group-name-text {
  font-size: 13.5px;
  color: #334155;
  font-weight: 600;
}

.empty-meta-text {
  font-size: 13px;
  color: #94a3b8;
}

/* 备注与标签内容 */
.remark-section {
  width: 100%;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
}

.remark-label {
  font-size: 13px;
  color: #64748b;
}

.remark-val {
  font-size: 13.5px;
  color: #1e293b;
  font-weight: 600;
}

.tag-section {
  width: 100%;
  padding-top: 14px;
}

.tag-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
}

.tag-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 600;
}

.tag-badge.blue {
  background-color: #eff6ff;
  color: #3b82f6;
}
.tag-badge.purple {
  background-color: #faf5ff;
  color: #a855f7;
}
.tag-badge.green {
  background-color: #f0fdf4;
  color: #22c55e;
}
.tag-badge.orange {
  background-color: #fff7ed;
  color: #f97316;
}

/* 更多操作卡片 */
.more-actions-card {
  width: 100%;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

.actions-row {
  width: 100%;
  padding-top: 8px;
}

.action-btn {
  flex: 1;
  height: 40px;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.action-btn:hover {
  background-color: #fef2f2;
}

.action-btn-text {
  font-size: 13.5px;
  font-weight: 600;
  color: #ef4444;
}

.action-divider {
  width: 1px;
  height: 24px;
  background-color: #f1f5f9;
}

.card-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
}

.flex-wrap {
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .contact-card-container {
    height: auto;
    min-height: 100%;
    padding: 16px;
    gap: 14px;
    background-color: #f6f7fb;
  }

  .header-card {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 16px;
    padding: 18px;
    border-radius: 12px;
  }

  .header-identity {
    width: 100%;
    min-width: 0;
    gap: 12px;
  }

  .char-avatar {
    width: 58px;
    height: 58px;
  }

  .avatar-text {
    font-size: 24px;
  }

  .header-meta {
    flex: 1;
    min-width: 0;
  }

  .name-status-row {
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    gap: 6px;
  }

  .card-name {
    max-width: 100%;
    font-size: 20px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .status-capsule {
    min-height: 24px;
    padding: 3px 9px;
  }

  .card-remark {
    font-size: 13px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .btn-send {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    border-radius: 10px;
  }

  .details-grid {
    gap: 12px;
  }

  .detail-card,
  .more-actions-card {
    min-height: auto;
    padding: 16px;
    border-radius: 12px;
  }

  .card-title-row {
    margin-bottom: 12px;
    padding-bottom: 8px;
  }

  .info-row,
  .remark-section {
    align-items: flex-start;
    gap: 12px;
  }

  .info-label {
    flex-shrink: 0;
  }

  .info-value,
  .remark-val {
    min-width: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .actions-row {
    flex-direction: column;
    align-items: stretch;
    padding-top: 0;
  }

  .action-btn {
    width: 100%;
    height: 44px;
    justify-content: flex-start;
    padding: 0 4px;
    box-sizing: border-box;
  }

  .action-divider {
    width: 100%;
    height: 1px;
  }
}

@container (max-width: 560px) {
  .contact-card-container {
    height: auto;
    min-height: 100%;
    padding: 16px;
    gap: 14px;
    background-color: #f6f7fb;
  }

  .header-card {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 16px;
    padding: 18px;
    border-radius: 12px;
  }

  .header-identity {
    width: 100%;
    min-width: 0;
    gap: 12px;
  }

  .char-avatar {
    width: 58px;
    height: 58px;
  }

  .avatar-text {
    font-size: 24px;
  }

  .header-meta {
    flex: 1;
    min-width: 0;
  }

  .name-status-row {
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    gap: 6px;
  }

  .card-name {
    max-width: 100%;
    font-size: 20px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .status-capsule {
    min-height: 24px;
    padding: 3px 9px;
  }

  .card-remark {
    font-size: 13px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .btn-send {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    border-radius: 10px;
  }

  .details-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .detail-card,
  .more-actions-card {
    min-height: auto;
    padding: 16px;
    border-radius: 12px;
  }

  .card-title-row {
    margin-bottom: 12px;
    padding-bottom: 8px;
  }

  .info-row,
  .remark-section {
    align-items: flex-start;
    gap: 12px;
  }

  .info-label {
    flex-shrink: 0;
  }

  .info-value,
  .remark-val {
    min-width: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .group-row-item {
    min-width: 0;
  }

  .group-name-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions-row {
    flex-direction: column;
    align-items: stretch;
    padding-top: 0;
  }

  .action-btn {
    width: 100%;
    height: 44px;
    justify-content: flex-start;
    padding: 0 4px;
    box-sizing: border-box;
  }

  .action-divider {
    width: 100%;
    height: 1px;
  }
}
</style>
