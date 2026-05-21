<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLoginStore } from '../stores/loginStore';
import { Message } from '@arco-design/web-vue';

const router = useRouter();
const loginStore = useLoginStore();

const phone = ref('008618337488675');
const password = ref('123456');
const loading = ref(false);

async function handleLogin() {
  if (!phone.value || !password.value) {
    Message.warning('请输入手机号 and 密码');
    return;
  }
  loading.value = true;
  try {
    await loginStore.loginWithPassword(phone.value, password.value);
    Message.success('登录成功');
    router.push('/chat');
  } catch (err: any) {
    console.error('Login error', err);
    Message.error(err.msg || '登录失败，请检查账号密码');
  } finally {
    loading.value = false;
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
          <label class="form-label">手机号</label>
          <input 
            v-model="phone" 
            type="text" 
            placeholder="请输入手机号" 
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
      
      <div class="login-footer">
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

.login-footer span {
  font-weight: 600;
  color: var(--text-primary);
}
</style>
