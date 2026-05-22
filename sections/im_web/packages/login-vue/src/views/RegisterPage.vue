<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import { authApi } from '@tsdaodao/datasource-vue';
import { buildLoginDevice, useLoginStore } from '../stores/loginStore';

const router = useRouter();
const loginStore = useLoginStore();

const zone = ref('0086');
const phone = ref('18337488675');
const name = ref('leng');
const password = ref('123456');
const code = ref('123456');
const loading = ref(false);

function buildUsername() {
  return `${zone.value.trim()}${phone.value.trim()}`;
}

async function handleSendCode() {
  if (!zone.value.trim() || !phone.value.trim()) {
    Message.warning('请输入区号和手机号');
    return;
  }

  loading.value = true;
  try {
    await authApi.getRegisterSmsCode({
      zone: zone.value.trim(),
      phone: phone.value.trim()
    });
    Message.success('验证码已发送');
  } catch (err: any) {
    Message.error(err?.msg || '发送验证码失败');
  } finally {
    loading.value = false;
  }
}

async function handleRegister() {
  if (!zone.value.trim() || !phone.value.trim() || !name.value.trim() || !password.value.trim() || !code.value.trim()) {
    Message.warning('请填写完整注册信息');
    return;
  }

  loading.value = true;
  try {
    await authApi.register({
      zone: zone.value.trim(),
      phone: phone.value.trim(),
      name: name.value.trim(),
      code: code.value.trim(),
      password: password.value.trim(),
      flag: 1,
      device: buildLoginDevice()
    });
    await loginStore.loginWithPassword(buildUsername(), password.value.trim());
    Message.success('注册成功');
    router.push('/chat');
  } catch (err: any) {
    Message.error(err?.msg || '注册失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="register-wrapper">
    <div class="register-card">
      <div class="register-header">
        <h2 class="register-title">创建账号</h2>
        <p class="register-subtitle">新 UI 注册入口</p>
      </div>

      <div class="register-form">
        <div class="form-row">
          <div class="form-item zone-item">
            <label class="form-label">区号</label>
            <input v-model="zone" class="form-input" type="text" placeholder="0086" :disabled="loading" />
          </div>
          <div class="form-item phone-item">
            <label class="form-label">手机号</label>
            <input v-model="phone" class="form-input" type="text" placeholder="11 位手机号" :disabled="loading" />
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">昵称</label>
          <input v-model="name" class="form-input" type="text" placeholder="请输入昵称" :disabled="loading" />
        </div>
        <div class="form-item">
          <label class="form-label">验证码</label>
          <div class="code-row">
            <input v-model="code" class="form-input" type="text" placeholder="验证码" :disabled="loading" />
            <button class="code-btn" :disabled="loading" @click="handleSendCode">获取验证码</button>
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">密码</label>
          <input v-model="password" class="form-input" type="password" placeholder="请输入密码" :disabled="loading" />
        </div>
        <button class="register-btn" :disabled="loading" @click="handleRegister">
          <span v-if="loading">正在注册...</span>
          <span v-else>注册账号</span>
        </button>
      </div>

      <div class="register-footer">
        <router-link to="/login">返回登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-secondary);
}

.register-card {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  background: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
}

.register-header {
  margin-bottom: 28px;
  text-align: center;
}

.register-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.register-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-row {
  display: flex;
  gap: 12px;
  width: 100%;
  align-items: flex-end;
}

.zone-item {
  flex: 0 0 96px;
}

.phone-item {
  flex: 1 1 auto;
  min-width: 0;
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
}

.form-input {
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.code-btn,
.register-btn {
  height: 40px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.code-btn {
  box-sizing: border-box;
  padding: 0 14px;
  white-space: nowrap;
  background: var(--bg-secondary);
  color: var(--text-primary);
  flex: 0 0 auto;
}

.register-btn {
  background: var(--primary-color, #165dff);
  color: #fff;
  font-weight: 600;
}

.register-footer {
  margin-top: 18px;
  text-align: center;
  font-size: 13px;
}

@media (max-width: 460px) {
  .register-card {
    padding: 28px 20px;
    margin: 0 16px;
  }

  .form-row,
  .code-row {
    flex-wrap: wrap;
  }

  .zone-item,
  .phone-item {
    flex: 1 1 100%;
  }
}
</style>
