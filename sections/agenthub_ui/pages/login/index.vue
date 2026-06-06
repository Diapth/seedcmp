<template>
  <view class="login-page">
    <view class="login-visual-panel">
      <view class="visual-card">
        <image
          class="visual-image"
          mode="aspectFill"
          alt="AgentHub 协同工作场景"
          src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=960&q=80"
        />
      </view>

      <view class="visual-footer">
        <text>2026 AgentHub 通讯. 保留所有权利</text>
      </view>
    </view>

    <view class="login-form-panel">
      <view class="login-card flex-column">
        <view class="login-header">
          <view class="logo-circle">
            <AppIcon name="chat" :size="32" color="#ffffff" />
          </view>
          <text class="app-name">AgentHub 通讯</text>
          <text class="app-subtitle">连接团队与多智能体的协作门户</text>
        </view>

        <view class="login-tabs">
          <view
            :class="['login-tab', { active: loginMode === 'password' }]"
            @click="loginMode = 'password'"
          >
            <text>账号登录</text>
          </view>
          <view
            :class="['login-tab', { active: loginMode === 'qr' }]"
            @click="loginMode = 'qr'"
          >
            <text>二维码登录</text>
          </view>
        </view>

        <view class="error-banner" v-if="errorMessage">
          <AppIcon name="info" :size="16" color="#ffffff" />
          <text class="error-text">{{ errorMessage }}</text>
        </view>

        <view class="form-container" v-if="loginMode === 'password'">
          <view class="input-group">
            <text class="input-label">手机号 / 用户名</text>
            <view class="input-wrapper">
              <AppIcon name="user" :size="18" color="var(--color-text-muted)" class="input-icon" />
              <input 
                type="text" 
                v-model="phone" 
                placeholder="手机号 / 用户名" 
                class="form-input" 
                placeholder-style="color: var(--color-text-muted)"
              />
            </view>
          </view>
          
          <view class="input-group">
            <text class="input-label">密码</text>
            <view class="input-wrapper">
              <AppIcon name="lock" :size="18" color="var(--color-text-muted)" class="input-icon" />
              <input 
                :type="showPassword ? 'text' : 'password'" 
                v-model="password" 
                placeholder="请输入密码" 
                class="form-input" 
                placeholder-style="color: var(--color-text-muted)"
              />
              <view class="eye-icon" @click="showPassword = !showPassword">
                <AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="18" color="var(--color-text-muted)" />
              </view>
            </view>
          </view>

          <view class="form-options">
            <label class="remember-row">
              <checkbox :checked="rememberMe" @tap="rememberMe = !rememberMe" color="#004ac6" />
              <text>自动登录</text>
            </label>
            <text class="footer-link-muted" @click="handleForgotPassword">忘记密码？</text>
          </view>
          
          <button class="btn-submit" :loading="isLoading" :disabled="isLoading" @click="handleLogin">
            <text v-if="!isLoading">安全登录</text>
            <text v-else>正在登录...</text>
          </button>
        </view>

        <view class="qr-container flex-column align-center" v-else>
          <view class="qr-frame" :class="{ unavailable: !qrAvailable }">
            <view class="qr-box">
              <view class="qr-finder-corner top-left"></view>
              <view class="qr-finder-corner top-right"></view>
              <view class="qr-finder-corner bottom-left"></view>
              <view class="qr-finder-corner bottom-right"></view>
              <view class="qr-scanning-bar"></view>
              <AppIcon name="chat" :size="48" color="var(--color-primary)" />
            </view>
          </view>
          <text class="qr-tip">{{ qrTip }}</text>
        </view>

        <view class="login-footer-links">
          <text class="footer-text">还没有账号？</text>
          <text class="footer-link" @click="navigateToRegister">注册账号</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useConversationStore } from '@/stores/conversation';
import { useImStore } from '@/stores/im';
import { useSettingsStore } from '@/stores/settings';
import { useUserStore } from '@/stores/user';
import { initSdk } from '@/utils/wk-sdk.js';
import AppIcon from '@/components/common/AppIcon.vue';

const authStore = useAuthStore();
const conversationStore = useConversationStore();
const userStore = useUserStore();
const imStore = useImStore();
const settingsStore = useSettingsStore();

const loginMode = ref('password'); // 'password' | 'qr'
const phone = ref('');
const password = ref('');
const showPassword = ref(false);
const rememberMe = ref(true);
const isLoading = ref(false);
const errorMessage = ref('');
const qrMessage = ref('二维码登录后端能力待确认');

const qrAvailable = computed(() => settingsStore.qrLogin.available);
const qrTip = computed(() => qrAvailable.value ? '请使用手机端 App 扫码登录' : qrMessage.value);

watch(loginMode, async (mode) => {
  errorMessage.value = '';
  if (mode !== 'qr') return;
  const result = await settingsStore.generateQrLoginToken();
  qrMessage.value = result.message || (result.available ? '请使用手机端 App 扫码登录' : '二维码登录后端能力待确认');
});

function toggleLoginMode() {
  loginMode.value = loginMode.value === 'password' ? 'qr' : 'password';
  errorMessage.value = '';
}

function navigateToRegister() {
  uni.navigateTo({
    url: '/pages/login/register'
  });
}

function handleForgotPassword() {
  uni.showToast({
    title: '密码找回后端能力待确认',
    icon: 'none'
  });
}

async function handleLogin() {
  if (!phone.value || !password.value) {
    errorMessage.value = '请填写账号和密码';
    return;
  }
  
  errorMessage.value = '';
  isLoading.value = true;
  try {
    const loginResult = await authStore.login({
      username: phone.value,
      password: password.value
    });
    await userStore.fetchMe().catch(() => undefined);
    await imStore.fetchImAddress(loginResult.uid).catch(() => undefined);
    await conversationStore.fetchConversations().catch(() => undefined);
    if (imStore.wsAddr) {
      await initSdk({
        uid: loginResult.uid,
        token: imStore.imToken || authStore.accessToken,
        wsAddr: imStore.wsAddr
      }).catch(() => undefined);
    }
    uni.reLaunch({
      url: '/pages/chat/index'
    });
  } catch (err) {
    errorMessage.value = err?.message || '登录失败';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  width: 100vw;
  height: 100vh;
  background: var(--color-bg-base);
  display: flex;
  overflow: hidden;
}

.login-visual-panel {
  width: 50%;
  min-width: 520px;
  background:
    linear-gradient(135deg, rgba(243, 243, 254, 0.96), rgba(219, 225, 255, 0.88)),
    var(--color-bg-muted);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 48px;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.login-visual-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 74, 198, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 74, 198, 0.05) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}

.visual-card {
  z-index: 1;
  width: min(88%, 560px);
  aspect-ratio: 1.18;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 30px 55px rgba(25, 27, 35, 0.16);
  background-color: var(--color-bg-surface);
}

.visual-image {
  width: 100%;
  height: 100%;
  display: block;
}

.visual-footer {
  z-index: 1;
  position: absolute;
  bottom: 44px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.login-form-panel {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  box-sizing: border-box;
}

.login-card {
  width: 100%;
  max-width: 420px;
  border-radius: 18px;
  padding: 40px 36px;
  position: relative;
  background-color: var(--color-bg-surface);
  box-shadow: none;
  border: none;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-circle {
  width: 64px;
  height: 64px;
  background-color: var(--color-primary);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(79, 70, 229, 0.3);
  margin-bottom: 16px;
}

.app-name {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}

.app-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.login-tabs {
  display: flex;
  width: 100%;
  height: 48px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 28px;
}

.login-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;
}

.login-tab.active {
  color: var(--color-primary);
}

.login-tab.active::after {
  content: "";
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: -1px;
  height: 2px;
  border-radius: 999px;
  background-color: var(--color-primary);
}

.error-banner {
  background-color: var(--color-error);
  padding: 10px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.error-text {
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
}

.form-input {
  width: 100%;
  height: 48px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding-left: 44px;
  padding-right: 44px;
  box-sizing: border-box;
  font-size: 15px;
  color: var(--color-text-primary);
  background-color: var(--color-bg-surface);
  transition: all 0.2s ease;
}
.form-input:focus {
  border-color: var(--color-primary);
}

.eye-icon {
  position: absolute;
  right: 14px;
  cursor: pointer;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -4px;
}

.remember-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.btn-submit {
  width: 100%;
  height: 48px;
  background-color: var(--color-primary);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
  margin-top: 8px;
}
.btn-submit:hover {
  background-color: var(--color-primary-hover);
}

.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
}

.qr-frame {
  width: 160px;
  height: 160px;
  padding: 10px;
  background-color: #ffffff;
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-frame.unavailable {
  opacity: 0.55;
  filter: grayscale(1);
}

.qr-box {
  width: 120px;
  height: 120px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--color-border);
}

.qr-finder-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 3px solid var(--color-primary);
}
.top-left { top: 0; left: 0; border-right: none; border-bottom: none; }
.top-right { top: 0; right: 0; border-left: none; border-bottom: none; }
.bottom-left { bottom: 0; left: 0; border-right: none; border-top: none; }
.bottom-right { bottom: 0; right: 0; border-left: none; border-top: none; }

.qr-scanning-bar {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background-color: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary);
  animation: scan 2.5s infinite ease-in-out;
}

.qr-tip {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.login-footer-links {
  margin-top: 28px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.footer-text {
  color: var(--color-text-secondary);
}

.footer-link {
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
}

.footer-link-muted {
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 600;
}

@keyframes scan {
  0% { top: 0%; }
  50% { top: 100%; }
  100% { top: 0%; }
}

@media (max-width: 1023px) {
  .login-page {
    align-items: center;
    justify-content: center;
    background: var(--color-bg-base);
    padding: 20px;
    box-sizing: border-box;
  }

  .login-visual-panel {
    display: none;
  }

  .login-form-panel {
    width: 100%;
    max-width: 460px;
    flex: none;
    padding: 0;
    background: transparent;
  }

  .login-card {
    padding: 32px 24px;
    border: 1px solid var(--color-border);
    box-shadow: 0 12px 28px rgba(25, 27, 35, 0.08);
  }
}

@media (max-width: 420px) {
  .login-page {
    padding: 14px;
  }

  .login-card {
    padding: 28px 18px;
  }

  .app-name {
    font-size: 24px;
  }
}
</style>
