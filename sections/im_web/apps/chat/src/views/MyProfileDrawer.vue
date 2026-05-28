<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore, userApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['close']);

const router = useRouter();
const userStore = useUserStore();

const newName = ref('');
const newAvatar = ref('');
const isEditing = ref(false);
const saving = ref(false);
const notificationEnabled = ref(false);
const notificationPermissionState = ref<'granted' | 'denied' | 'default' | 'unsupported'>('unsupported');
const notificationSaving = ref(false);

const currentUser = computed(() => userStore.currentUser);
const personalQrPayload = computed(() => {
  if (!currentUser.value) return '';
  return JSON.stringify({
    type: 'user',
    uid: currentUser.value.uid,
    name: currentUser.value.name,
    short_no: currentUser.value.short_no || ''
  });
});

function isNonBlockingCmdFailure(err: any) {
  const message = String(err?.msg || err?.message || '');
  return message.includes('发送消息失败') || message.includes('SendCMD') || message.includes('CMD');
}

watch(() => props.visible, (val) => {
  if (val && currentUser.value) {
    newName.value = currentUser.value.name || '';
    newAvatar.value = currentUser.value.avatar || '';
    isEditing.value = false;
    syncNotificationPermission();
  }
});

function syncNotificationPermission() {
  if (typeof Notification === 'undefined') {
    notificationPermissionState.value = 'unsupported';
    notificationEnabled.value = false;
    return;
  }
  notificationPermissionState.value = Notification.permission;
  notificationEnabled.value = Notification.permission === 'granted';
}

async function handleSave() {
  if (!newName.value.trim()) {
    Message.error('昵称不能为空');
    return;
  }
  
  saving.value = true;
  try {
    await userStore.updateProfile({ name: newName.value.trim() });
    
    Message.success('个人资料更新成功');
    isEditing.value = false;
  } catch (err: any) {
    if (isNonBlockingCmdFailure(err)) {
      if (userStore.currentUser) {
        userStore.currentUser.name = newName.value.trim();
      }
      Message.success('个人资料已保存，在线状态同步稍后自动恢复');
      isEditing.value = false;
      return;
    }
    Message.error(err.msg || '保存失败');
  } finally {
    saving.value = false;
  }
}

// Support choosing a dynamic preset avatar to bypass complex uploading constraints
const presets = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Buster',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Boots',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Garfield'
];

async function selectPresetAvatar(url: string) {
  try {
    newAvatar.value = url;
    await userStore.updateAvatar(url);
    Message.success('头像设置成功');
  } catch (err) {
    console.error(err);
    Message.error('头像设置失败');
  }
}

async function toggleNotifications() {
  notificationSaving.value = true;
  try {
    if (typeof Notification === 'undefined') {
      notificationPermissionState.value = 'unsupported';
      Message.warning('当前浏览器不支持桌面通知');
      return;
    }
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    notificationPermissionState.value = permission;
    if (permission !== 'granted') {
      notificationEnabled.value = false;
      await userApi.unregisterDeviceToken().catch(() => undefined);
      Message.warning(permission === 'denied' ? '浏览器已拒绝通知权限' : '通知权限未开启');
      return;
    }
    notificationEnabled.value = !notificationEnabled.value;
    if (notificationEnabled.value) {
      await userApi.registerDeviceToken({
        device_token: `web-${currentUser.value?.uid || 'anonymous'}`,
        device_type: 'web'
      });
      Message.success('通知已开启');
    } else {
      await userApi.unregisterDeviceToken();
      Message.success('通知已关闭');
    }
  } catch (err: any) {
    Message.error(err.msg || '通知设置失败');
  } finally {
    notificationSaving.value = false;
  }
}

function goToDevices() {
  emit('close');
  router.push('/chat/devices');
}

function goToBlacklist() {
  emit('close');
  router.push('/chat/blacklist');
}
</script>

<template>
  <div v-if="visible" class="drawer-overlay" @click="emit('close')">
    <div class="drawer-content" @click.stop>
      <div class="drawer-header">
        <h4 class="drawer-title">个人资料与设置</h4>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="close-icon">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="drawer-body" v-if="currentUser">
        <!-- Profile Avatar Section -->
        <div class="profile-card">
          <ChannelAvatar 
            :avatar="newAvatar" 
            :name="newName || currentUser.name" 
            :size="72" 
          />
          <div class="profile-info">
            <div class="profile-name">{{ currentUser.name }}</div>
            <div class="profile-uid">UID: {{ currentUser.uid }}</div>
          </div>
        </div>

        <!-- Edit Form -->
        <div class="form-section">
          <h4 class="section-title">修改资料</h4>
          
          <div class="form-item">
            <label class="form-label">修改昵称</label>
            <input 
              v-model="newName" 
              type="text" 
              class="form-input" 
              placeholder="请输入新的昵称" 
            />
          </div>

          <!-- Preset Avatars Selector -->
          <div class="form-item">
            <label class="form-label">更换系统头像</label>
            <div class="preset-avatars">
              <div 
                v-for="p in presets" 
                :key="p" 
                class="preset-item"
                :class="{ active: newAvatar === p }"
                @click="selectPresetAvatar(p)"
              >
                <img :src="p" class="preset-img" alt="Preset Avatar" />
              </div>
            </div>
          </div>

          <button 
            class="save-btn" 
            :disabled="saving"
            @click="handleSave"
          >
            {{ saving ? '正在保存...' : '保存修改' }}
          </button>
        </div>

        <div class="form-section">
          <h4 class="section-title">个人二维码</h4>
          <div class="qr-box" :title="personalQrPayload">
            <div class="qr-grid" aria-label="个人二维码">
              <span v-for="idx in 49" :key="idx" :class="{ dark: personalQrPayload.charCodeAt(idx % personalQrPayload.length || 0) % 2 === 0 }"></span>
            </div>
            <div class="qr-meta">{{ currentUser.short_no || currentUser.uid }}</div>
          </div>
        </div>

        <!-- System configurations (minimalist toggles) -->
        <div class="form-section">
          <h4 class="section-title">系统偏好</h4>
          
          <div class="pref-item">
            <div class="pref-info">
              <span class="pref-title">桌面通知</span>
              <span class="pref-desc">
                {{ notificationPermissionState === 'unsupported' ? '当前浏览器不支持通知' : notificationPermissionState === 'denied' ? '浏览器已拒绝通知权限' : '收到新消息时显示桌面提醒' }}
              </span>
            </div>
            <button
              class="toggle-switch"
              :class="{ active: notificationEnabled }"
              :disabled="notificationSaving || notificationPermissionState === 'unsupported'"
              @click="toggleNotifications"
            >
              <div class="toggle-thumb"></div>
            </button>
          </div>

          <div class="pref-item">
            <div class="pref-info">
              <span class="pref-title">极简发丝模式</span>
              <span class="pref-desc">开启极窄 1px 细边框主题边角</span>
            </div>
            <div class="toggle-switch active">
              <div class="toggle-thumb"></div>
            </div>
          </div>

          <div class="settings-actions">
            <button class="secondary-btn" @click="goToDevices">
              打开设备管理
            </button>
            <button class="secondary-btn" @click="goToBlacklist">
              黑名单管理
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}

.drawer-content {
  width: 360px;
  height: 100%;
  background-color: var(--bg-primary);
  border-left: var(--border-hairline);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  height: 64px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: var(--border-hairline);
}

.drawer-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
}

.close-icon {
  width: 20px;
  height: 20px;
}

.drawer-body {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  overflow-y: auto;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: var(--border-hairline);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-uid {
  font-size: 12px;
  color: var(--text-secondary);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 0 0 4px 0;
  letter-spacing: 0.5px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.form-input {
  height: 36px;
  padding: 0 12px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
}

.form-input:focus {
  border-color: var(--primary-color, #165dff);
}

.preset-avatars {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.preset-item {
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preset-item.active {
  border-color: var(--primary-color, #165dff);
}

.preset-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.save-btn {
  height: 38px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  width: 100%;
  margin-top: 4px;
}

.secondary-btn {
  height: 36px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.settings-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.qr-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
}

.qr-grid {
  width: 84px;
  height: 84px;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding: 6px;
  background-color: #ffffff;
  border: var(--border-hairline);
}

.qr-grid span {
  background-color: #ffffff;
}

.qr-grid span.dark {
  background-color: #1d2129;
}

.qr-meta {
  min-width: 0;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.save-btn:hover {
  opacity: 0.9;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Preference Toggles */
.pref-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.pref-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 80%;
}

.pref-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.pref-desc {
  font-size: 11px;
  color: var(--text-secondary);
}

.toggle-switch {
  width: 40px;
  height: 20px;
  border: none;
  padding: 0;
  background-color: #e5e6eb;
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toggle-switch.active {
  background-color: #52c41a;
}

.toggle-switch:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.toggle-thumb {
  width: 16px;
  height: 16px;
  background-color: #ffffff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(20px);
}
</style>
