<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authApi } from '@tsdaodao/datasource-vue';
import { Message } from '@arco-design/web-vue';

const router = useRouter();
const devices = ref<any[]>([]);
const loading = ref(false);
const quittingSession = ref(false);

async function loadDevices() {
  loading.value = true;
  try {
    const res: any = await authApi.getDevices();
    devices.value = Array.isArray(res) ? res : (res?.data || []);
  } catch (err: any) {
    Message.error(err.msg || '获取设备列表失败');
  } finally {
    loading.value = false;
  }
}

async function removeDevice(deviceId: string) {
  try {
    await authApi.deleteDevice(deviceId);
    Message.success('设备已移除');
    await loadDevices();
  } catch (err: any) {
    Message.error(err.msg || '移除设备失败');
  }
}

async function quitCurrentSession() {
  quittingSession.value = true;
  try {
    await authApi.quit();
    Message.success('当前 Web 会话已退出');
  } catch (err: any) {
    Message.error(err.msg || '退出当前会话失败');
  } finally {
    quittingSession.value = false;
  }
}

function goBack() {
  router.back();
}

function formatDeviceFlag(flag: number) {
  if (flag === 2) return 'PC';
  if (flag === 1) return 'Web';
  return '移动端';
}

onMounted(() => {
  loadDevices();
});
</script>

<template>
  <div class="devices-page">
    <div class="page-header">
      <button class="plain-btn" @click="goBack">返回</button>
      <h3 class="page-title">设备管理</h3>
      <button class="danger-btn" :disabled="quittingSession" @click="quitCurrentSession">
        {{ quittingSession ? '处理中...' : '退出当前会话' }}
      </button>
    </div>

    <div v-if="loading" class="page-state">正在加载设备...</div>
    <div v-else-if="devices.length === 0" class="page-state">暂无在线设备记录</div>
    <div v-else class="device-list">
      <div v-for="device in devices" :key="device.device_id || device.id" class="device-item">
        <div class="device-meta">
          <div class="device-name">{{ device.device_name || '未命名设备' }}</div>
          <div class="device-desc">
            {{ device.device_model || '未知型号' }} · {{ formatDeviceFlag(device.device_flag) }}
          </div>
        </div>
        <button class="plain-btn" @click="removeDevice(device.device_id || device.id)">移除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.devices-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

.page-header {
  height: 64px;
  padding: 0 16px;
  border-bottom: var(--border-hairline);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.plain-btn,
.danger-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: var(--border-hairline);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.danger-btn {
  background-color: #fff1f0;
  color: #cf1322;
  border-color: #ffccc7;
}

.page-state {
  padding: 32px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.device-list {
  display: flex;
  flex-direction: column;
}

.device-item {
  padding: 14px 16px;
  border-bottom: var(--border-hairline);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.device-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.device-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
