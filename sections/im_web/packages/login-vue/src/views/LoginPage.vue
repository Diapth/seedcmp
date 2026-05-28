<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLoginStore } from '../stores/loginStore';
import { Message } from '@arco-design/web-vue';

const router = useRouter();
const loginStore = useLoginStore();

const username = ref('18337488675');
const password = ref('123456');
const loading = ref(false);
const qrLoading = ref(false);

const qrStateText = computed(() => {
  if (loginStore.state === 'qr_waiting') return '等待手机扫码';
  if (loginStore.state === 'qr_scanned') return '已扫码，请在手机端确认';
  if (loginStore.state === 'qr_confirmed') return '扫码已确认，正在登录';
  if (loginStore.state === 'qr_expired') return '二维码已过期';
  if (loginStore.state === 'qr_rejected') return '已取消扫码登录';
  if (loginStore.state === 'qr_failed') return loginStore.qrError || '扫码登录暂不可用';
  return '使用手机端扫码安全登录';
});

async function handleLogin() {
  if (!username.value || !password.value) {
    Message.warning('请输入手机号/用户名和密码');
    return;
  }
  loading.value = true;
  try {
    await loginStore.loginWithPassword(username.value, password.value);
    Message.success('登录成功');
    router.push('/chat');
  } catch (err: any) {
    console.error('Login error', err);
    Message.error(err.msg || '登录失败，请检查账号密码');
  } finally {
    loading.value = false;
  }
}

async function startQrLogin() {
  qrLoading.value = true;
  try {
    await loginStore.startQrLogin();
  } catch (err: any) {
    Message.error(err.msg || '扫码登录暂不可用');
  } finally {
    qrLoading.value = false;
  }
}

async function refreshQrLogin() {
  await startQrLogin();
}

async function pollQrLogin() {
  qrLoading.value = true;
  try {
    const state = await loginStore.pollQrLoginStatus();
    if (state === 'qr_confirmed') {
      await loginStore.confirmQrLogin();
      Message.success('登录成功');
      router.push('/chat');
    }
  } catch (err: any) {
    Message.error(err.msg || '扫码登录状态获取失败');
  } finally {
    qrLoading.value = false;
  }
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="login-header">
        <h2 class="login-title">TangSengDaoDao</h2>
        <p class="login-subtitle">极简主义双色即时通讯系统</p>
      </div>

      <div class="login-form">
        <div class="form-item">
          <label class="form-label">手机号/用户名</label>
          <input 
            v-model="username" 
            type="text" 
            placeholder="请输入 11 位手机号或 0086 开头用户名" 
            class="form-input"
            :disabled="loading"
          />
        </div>

        <div class="form-item">
          <label class="form-label">密码</label>
          <input 
            v-model="password" 
            type="password" 
            placeholder="请输入密码" 
            class="form-input"
            :disabled="loading"
            @keyup.enter="handleLogin"
          />
        </div>

        <button 
          class="login-btn" 
          :disabled="loading"
          @click="handleLogin"
        >
          <span v-if="loading">正在连接安全通道...</span>
          <span v-else>安全登录</span>
        </button>
      </div>

      <div class="qr-login-panel">
        <div class="qr-placeholder" :class="`state-${loginStore.state}`">
          <span v-if="loginStore.qrUuid">{{ loginStore.qrUuid.slice(0, 8) }}</span>
          <span v-else>QR</span>
        </div>
        <div class="qr-copy">
          <div class="qr-title">扫码登录</div>
          <div class="qr-state">{{ qrStateText }}</div>
          <div class="qr-actions">
            <button class="qr-btn" :disabled="qrLoading" @click="startQrLogin">生成二维码</button>
            <button class="qr-btn" :disabled="qrLoading || !loginStore.qrUuid" @click="pollQrLogin">检查状态</button>
            <button class="qr-btn" :disabled="qrLoading" @click="refreshQrLogin">刷新</button>
          </div>
        </div>
      </div>
      
      <div class="login-footer">
        <router-link
          class="register-link"
          to="/register"
        >
          注册账号
        </router-link>
        <span class="footer-separator">·</span>
        测试验证码/密码统一为 <span>123456</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: var(--bg-secondary);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  background-color: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  box-shadow: none !important;
}

.login-header {
  margin-bottom: 32px;
  text-align: center;
}

.login-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.login-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-input {
  height: 40px;
  padding: 0 12px;
  background-color: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  border-color: var(--primary-color, #165dff);
}

.login-btn {
  height: 42px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-btn:hover {
  opacity: 0.9;
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.qr-login-panel {
  margin-top: 20px;
  padding-top: 20px;
  border-top: var(--border-hairline);
  display: flex;
  gap: 12px;
  align-items: center;
}

.qr-placeholder {
  width: 76px;
  height: 76px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.qr-placeholder.state-qr_scanned,
.qr-placeholder.state-qr_confirmed {
  color: #237804;
  border-color: #95de64;
}

.qr-placeholder.state-qr_expired,
.qr-placeholder.state-qr_rejected,
.qr-placeholder.state-qr_failed {
  color: #cf1322;
  border-color: #ffccc7;
}

.qr-copy {
  min-width: 0;
  flex: 1;
}

.qr-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.qr-state {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.qr-actions {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.qr-btn {
  height: 28px;
  padding: 0 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.qr-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.login-footer span {
  font-weight: 600;
  color: var(--text-primary);
}

.register-link {
  color: var(--primary-color, #165dff);
  font-weight: 600;
  text-decoration: none;
}

.register-link:hover {
  text-decoration: underline;
}

.footer-separator {
  margin: 0 8px;
  color: var(--text-secondary) !important;
  font-weight: 400 !important;
}
</style>
