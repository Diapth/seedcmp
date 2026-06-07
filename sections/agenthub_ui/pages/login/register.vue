<template>
  <view class="login-page">
    <view class="login-wrapper">
      <view class="login-card glass-panel flex-column">
        
        <!-- Header Back Icon -->
        <view class="back-action" @click="goBack">
          <AppIcon name="back" :size="20" color="var(--color-primary)" />
          <text class="back-text">返回登录</text>
        </view>
        
        <!-- Title -->
        <view class="login-header">
          <text class="app-name">加入 AgentHub</text>
          <text class="app-subtitle">开启您的智能化工作协同体验</text>
        </view>
        
        <!-- Form Errors -->
        <view class="error-banner" v-if="errorMessage">
          <AppIcon name="info" :size="16" color="#ffffff" />
          <text class="error-text">{{ errorMessage }}</text>
        </view>
        
        <!-- Form -->
        <view class="form-container">
          <view class="input-group">
            <text class="input-label">手机号</text>
            <view class="input-wrapper">
              <AppIcon name="user" :size="18" color="var(--color-text-muted)" class="input-icon" />
              <input 
                type="number" 
                v-model="phone" 
                placeholder="请输入手机号" 
                class="form-input" 
                placeholder-style="color: var(--color-text-muted)"
              />
            </view>
          </view>
          
          <view class="input-group">
            <text class="input-label">验证码</text>
            <view class="input-wrapper flex-row gap-2">
              <view class="flex-1 position-relative">
                <AppIcon name="lock" :size="18" color="var(--color-text-muted)" class="input-icon" />
                <input 
                  type="number" 
                  v-model="code" 
                  placeholder="短信验证码" 
                  class="form-input" 
                  placeholder-style="color: var(--color-text-muted)"
                />
              </view>
              <button 
                class="btn-code" 
                :disabled="codeCountdown > 0"
                @click="sendCode"
              >
                {{ codeCountdown > 0 ? `${codeCountdown}s` : '获取验证码' }}
              </button>
            </view>
          </view>
          
          <view class="input-group">
            <text class="input-label">昵称</text>
            <view class="input-wrapper">
              <AppIcon name="user" :size="18" color="var(--color-text-muted)" class="input-icon" />
              <input 
                type="text" 
                v-model="nickname" 
                placeholder="请输入您的昵称" 
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
                type="password" 
                v-model="password" 
                placeholder="密码 (不少于6位)" 
                class="form-input" 
                placeholder-style="color: var(--color-text-muted)"
              />
            </view>
          </view>
          
          <button class="btn-submit" :loading="isLoading" :disabled="isLoading" @click="handleRegister">
            <text v-if="!isLoading">注册账号</text>
            <text v-else>正在注册...</text>
          </button>
        </view>
        
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import AppIcon from '@/components/common/AppIcon.vue';

const authStore = useAuthStore();
const phone = ref('');
const code = ref('');
const nickname = ref('');
const password = ref('');
const codeCountdown = ref(0);
const isLoading = ref(false);
const errorMessage = ref('');

function goBack() {
  uni.navigateBack();
}

async function sendCode() {
  if (!phone.value || phone.value.length < 11) {
    errorMessage.value = '请先输入正确的手机号';
    return;
  }
  
  errorMessage.value = '';
  try {
    await authStore.sendRegisterCode(phone.value);
    codeCountdown.value = 60;
    const timer = setInterval(() => {
      if (codeCountdown.value > 0) {
        codeCountdown.value--;
      } else {
        clearInterval(timer);
      }
    }, 1000);
    uni.showToast({
      title: '验证码发送成功',
      icon: 'success'
    });
  } catch (err) {
    errorMessage.value = err?.message || '验证码发送失败';
  }
}

async function handleRegister() {
  if (!phone.value || !code.value || !nickname.value || !password.value) {
    errorMessage.value = '请填写完整的注册信息';
    return;
  }
  
  if (password.value.length < 6) {
    errorMessage.value = '密码长度不能少于6位';
    return;
  }
  
  errorMessage.value = '';
  isLoading.value = true;
  try {
    const result = await authStore.register({
      phone: phone.value,
      code: code.value,
      name: nickname.value,
      password: password.value
    });
    uni.showToast({
      title: '注册成功',
      icon: 'success'
    });
    if (result?.token || authStore.isLoggedIn) {
      uni.reLaunch({ url: '/pages/chat/index' });
    } else {
      goBack();
    }
  } catch (err) {
    errorMessage.value = err?.message || '注册失败';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.login-wrapper {
  width: 100%;
  max-width: 420px;
  padding: 20px;
  box-sizing: border-box;
}

.login-card {
  border-radius: 24px;
  padding: 40px 32px;
  position: relative;
  background-color: var(--color-glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--color-glass-border);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}

.back-action {
  position: absolute;
  top: 24px;
  left: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.back-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.login-header {
  text-align: center;
  margin-top: 16px;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.app-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}

.app-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
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
  gap: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  z-index: 2;
}

.position-relative {
  position: relative;
}

.form-input {
  width: 100%;
  height: 48px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding-left: 44px;
  padding-right: 14px;
  box-sizing: border-box;
  font-size: 15px;
  color: var(--color-text-primary);
  background-color: var(--color-bg-base);
  transition: all 0.2s ease;
}
.form-input:focus {
  border-color: var(--color-primary);
}

.btn-code {
  height: 48px;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  padding: 0 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  min-width: 110px;
}
.btn-code::after {
  border: none;
}

.btn-submit {
  width: 100%;
  height: 48px;
  background-color: var(--color-primary);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
  margin-top: 10px;
}
.btn-submit:hover {
  background-color: var(--color-primary-hover);
}
</style>
