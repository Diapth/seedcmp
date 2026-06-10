<template>
  <AppSubpageShell>
    <view class="profile-page flex-column flex-1">
      <view class="profile-header flex-row align-center justify-between">
        <view class="header-left flex-row align-center">
          <view class="back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
          <text class="title">{{ viewedContact ? '资料卡片' : '个人资料' }}</text>
        </view>
      </view>

      <scroll-view scroll-y class="profile-scroll flex-1">
        <view v-if="viewedContact" class="profile-member-card">
          <ContactCard :contact="viewedContact" />
        </view>

        <view v-else class="profile-container">
          <view class="profile-card">
            <view class="profile-main flex-row align-center">
              <AppAvatar :src="user.avatar || ''" :text="user.nickname" :size="82" status="online" />
              <view class="profile-copy flex-column flex-1">
                <view class="profile-name-row flex-row align-center">
                  <text class="user-name">{{ user.nickname }}</text>
                  <text class="self-status">在线</text>
                </view>
                <text class="user-meta">手机号 {{ user.phone }}</text>
                <text class="user-meta email-meta">{{ user.email }}</text>
              </view>
              <button class="btn-secondary profile-edit-btn" @click="editProfile">
                <AppIcon name="edit" :size="15" color="var(--color-text-primary)" />
                <text>编辑资料</text>
              </button>
            </view>
          </view>

          <view class="profile-grid">
            <view class="info-panel">
              <text class="panel-title">我的二维码</text>
              <text class="qr-demo-caption">演示用二维码 · 扫码可扫描占位 URL</text>
              <view class="qr-box">
                <view v-for="n in 49" :key="n" class="qr-cell" :class="{ active: qrPattern(n) }"></view>
              </view>
              <text class="qr-desc">用于面对面添加好友，30 分钟内有效。</text>
              <button class="btn-primary" @click="refreshQr">刷新二维码</button>
            </view>

            <view class="info-panel">
              <text class="panel-title">账号状态</text>
              <view class="status-list">
                <view class="status-row flex-row align-center justify-between">
                  <text class="status-label">消息通知</text>
                  <text class="status-value">已开启</text>
                </view>
                <view class="status-row flex-row align-center justify-between">
                  <text class="status-label">登录设备</text>
                  <text class="status-value">2 台在线</text>
                </view>
                <view class="status-row flex-row align-center justify-between">
                  <text class="status-label">隐私保护</text>
                  <text class="status-value">标准</text>
                </view>
              </view>
              <view class="action-list">
                <view class="action-row flex-row align-center justify-between" @click="navigate('/pages/settings/devices')">
                  <text>设备与登录管理</text>
                  <AppIcon name="chevron-right" :size="14" color="var(--color-text-muted)" />
                </view>
                <view class="action-row flex-row align-center justify-between" @click="navigate('/pages/contacts/blacklist')">
                  <text>黑名单管理</text>
                  <AppIcon name="chevron-right" :size="14" color="var(--color-text-muted)" />
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <AppDialog
        v-model:visible="editVisible"
        title="编辑资料"
        variant="confirm"
        width="md"
        confirm-text="保存"
        cancel-text="取消"
        :loading="savingProfile"
        :confirm-disabled="!editForm.nickname.trim()"
        @confirm="saveProfile"
      >
        <view class="profile-edit-form flex-column">
          <view class="edit-field flex-column">
            <text class="edit-label">昵称</text>
            <input
              v-model="editForm.nickname"
              class="edit-input"
              maxlength="32"
              placeholder="请输入昵称"
              placeholder-style="color: var(--color-text-muted)"
            />
          </view>
          <view class="edit-field flex-column">
            <text class="edit-label">短号</text>
            <input
              v-model="editForm.shortNo"
              class="edit-input"
              maxlength="32"
              placeholder="可选"
              placeholder-style="color: var(--color-text-muted)"
            />
          </view>
          <view class="edit-field flex-column">
            <text class="edit-label">性别</text>
            <picker :range="sexOptions" range-key="label" :value="editForm.sexIndex" @change="changeSex">
              <view class="edit-picker flex-row align-center justify-between">
                <text>{{ sexOptions[editForm.sexIndex]?.label || '未设置' }}</text>
                <AppIcon name="chevron-right" :size="14" color="var(--color-text-muted)" />
              </view>
            </picker>
          </view>
          <text v-if="editError" class="edit-error">{{ editError }}</text>
        </view>
      </AppDialog>
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useAppStore } from '@/stores/app';
import { useNavigationStore } from '@/stores/navigation';
import { useContactStore } from '@/stores/contact';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppDialog from '@/components/common/AppDialog.vue';
import ContactCard from '@/components/contacts/ContactCard.vue';

const appStore = useAppStore();
const navStore = useNavigationStore();
const contactStore = useContactStore();
const qrSeed = ref(0);
const routeOptions = ref({});
const editVisible = ref(false);
const savingProfile = ref(false);
const editError = ref('');
const sexOptions = [
  { label: '未设置', value: 0 },
  { label: '男', value: 1 },
  { label: '女', value: 2 }
];
const editForm = ref({
  nickname: '',
  shortNo: '',
  sexIndex: 0
});

const user = computed(() => {
  return appStore.currentUser || {
    nickname: '我',
    phone: '13800000000',
    email: 'zhang.xiaoming@agenthub.im',
    avatar: ''
  };
});

const viewedContact = computed(() => {
  const id = readOption('id');
  if (!id || id === 'me') return null;

  const contact = contactStore.contacts.find((item) => item.id === id);
  return {
    id,
    nickname: readOption('nickname') || contact?.nickname || '用户',
    avatar: readOption('avatar') || contact?.avatar || '',
    phone: contact?.phone || '',
    pinyin: contact?.pinyin || readOption('nickname') || '',
    remark: readOption('remark') || contact?.remark || '',
    status: readOption('status') || contact?.status || 'offline',
    role: readOption('role') || ''
  };
});

onMounted(() => {
  refreshRouteOptions();
});

onShow(() => {
  refreshRouteOptions();
});

function refreshRouteOptions() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  routeOptions.value = currentPage?.$page?.options || {};
  navStore.setActiveModule(viewedContact.value ? 'contacts' : 'settings');
}

function readOption(key) {
  const value = routeOptions.value?.[key];
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function qrPattern(index) {
  const row = Math.floor((index - 1) / 7);
  const col = (index - 1) % 7;
  const isCorner =
    (row <= 1 && col <= 1) ||
    (row <= 1 && col >= 5) ||
    (row >= 5 && col <= 1);
  return isCorner || ((row * 3 + col * 5 + qrSeed.value) % 4 === 0);
}

function refreshQr() {
  // TODO: 接入真实 token + QR 库,当前只切换本地种子
  qrSeed.value += 1;
  uni.showToast({ title: '二维码已刷新', icon: 'success' });
}

function editProfile() {
  editForm.value = {
    nickname: user.value.nickname || user.value.name || '',
    shortNo: user.value.shortNo || user.value.short_no || '',
    sexIndex: Math.max(0, sexOptions.findIndex((item) => Number(item.value) === Number(user.value.sex || 0)))
  };
  editError.value = '';
  editVisible.value = true;
}

function changeSex(e) {
  editForm.value.sexIndex = Number(e.detail.value || 0);
}

async function saveProfile() {
  if (!editForm.value.nickname.trim()) {
    editError.value = '昵称不能为空';
    return;
  }
  savingProfile.value = true;
  editError.value = '';
  try {
    await appStore.updateCurrentUserProfile({
      name: editForm.value.nickname.trim(),
      shortNo: editForm.value.shortNo.trim(),
      sex: sexOptions[editForm.value.sexIndex]?.value || 0
    });
    editVisible.value = false;
    uni.showToast({ title: '资料已更新', icon: 'success' });
  } catch (error) {
    editError.value = error?.msg || error?.message || '资料保存失败';
  } finally {
    savingProfile.value = false;
  }
}

function navigate(url) {
  uni.navigateTo({ url });
}

function goBack() {
  uni.navigateBack({
    fail: () => uni.redirectTo({ url: '/pages/settings/index' })
  });
}
</script>

<style scoped>
.profile-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.profile-header {
  min-height: 64px;
  padding: 0 32px;
  background-color: var(--color-glass-bg);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(12px);
  box-sizing: border-box;
}

.header-left {
  gap: 12px;
}

.back-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn:hover {
  background-color: var(--color-bg-hover);
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.profile-scroll {
  height: 100%;
}

.profile-container {
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 28px 32px 40px;
  box-sizing: border-box;
}

.profile-member-card {
  min-height: 100%;
  padding: 18px;
  box-sizing: border-box;
}

.profile-member-card :deep(.contact-card-container) {
  min-height: calc(100vh - 118px);
  border-radius: 12px;
}

.profile-card,
.info-panel {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.profile-card {
  padding: 24px;
}

.profile-main {
  display: flex;
  gap: 18px;
}

.profile-copy {
  gap: 5px;
  min-width: 0;
}

.profile-name-row {
  gap: 8px;
  min-width: 0;
}

.user-name {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text-primary);
  min-width: 0;
  overflow-wrap: anywhere;
}

.user-meta {
  font-size: 13px;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}

.self-status {
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  background-color: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.btn-secondary,
.btn-primary {
  min-height: 44px;
  border-radius: 10px;
  padding: 0 16px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-secondary {
  background-color: var(--color-bg-muted);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.profile-edit-btn {
  gap: 6px;
  flex-shrink: 0;
}

.btn-primary {
  width: 100%;
  background-color: var(--color-primary);
  color: #ffffff;
  border: none;
  margin-top: 16px;
}

.btn-secondary::after,
.btn-primary::after {
  border: none;
}

.profile-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 18px;
  margin-top: 18px;
}

.info-panel {
  padding: 20px;
}

.panel-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.qr-box {
  width: 196px;
  height: 196px;
  margin: 18px auto 10px;
  padding: 12px;
  border-radius: 12px;
  background-color: var(--qr-surface);
  border: 1px solid var(--color-border);
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  box-sizing: border-box;
}

.qr-demo-caption {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-muted);
  font-style: italic;
}

.qr-cell {
  border-radius: 3px;
  background-color: var(--color-bg-muted);
}

.qr-cell.active {
  background-color: var(--color-text-primary);
}

.qr-desc {
  display: block;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.status-list {
  margin-top: 16px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
}

.status-row {
  min-height: 48px;
  padding: 0 14px;
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.status-row:last-child {
  border-bottom: none;
}

.status-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.status-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
}

.action-list {
  margin-top: 16px;
}

.action-row {
  min-height: 46px;
  display: flex;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
  color: var(--color-text-primary);
  font-size: 14px;
}

.profile-edit-form {
  gap: 14px;
}

.edit-field {
  gap: 6px;
}

.edit-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.edit-input,
.edit-picker {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  font-size: 14px;
  padding: 0 12px;
  box-sizing: border-box;
}

.edit-input {
  line-height: 44px;
}

.edit-picker {
  display: flex;
}

.edit-error {
  font-size: 12px;
  line-height: 1.45;
  color: var(--color-error);
}

@media (max-width: 768px) {
  .profile-header {
    min-height: 56px;
    padding: 0 12px;
  }

  .profile-container {
    padding: 16px;
  }

  .profile-member-card {
    padding: 0;
  }

  .profile-member-card :deep(.contact-card-container) {
    min-height: calc(100vh - 56px);
    border-radius: 0;
  }

  .profile-main {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 14px;
  }

  .profile-card {
    padding: 18px;
    border-radius: 12px;
  }

  .profile-copy {
    gap: 6px;
  }

  .profile-name-row {
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .user-name {
    font-size: 20px;
    line-height: 1.25;
  }

  .email-meta {
    max-width: 100%;
  }

  .profile-edit-btn {
    width: 100%;
    align-self: stretch;
    margin-top: 2px;
  }

  .profile-grid {
    grid-template-columns: 1fr;
  }

  .btn-secondary {
    align-self: flex-start;
  }
}
</style>
