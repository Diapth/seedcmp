<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useContactStore } from '@tsdaodao/contacts-vue';
import { commonApi, friendApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const props = defineProps<{
  uid: string;
  visible: boolean;
}>();

const emit = defineEmits(['close']);

const router = useRouter();
const userStore = useUserStore();
const contactStore = useContactStore();

const userDetails = computed(() => {
  return userStore.userCache[props.uid] || { uid: props.uid, name: '加载中...', avatar: '' };
});
const reportState = ref<'idle' | 'editing' | 'submitting' | 'submitted' | 'failed'>('idle');
const reportCategory = ref('spam');
const reportDescription = ref('');
const reportAttachment = ref('');
const reportTarget = computed(() => ({
  target_type: 'user',
  target_id: props.uid
}));

const isFriend = computed(() => {
  return contactStore.contacts.some(c => c.uid === props.uid);
});

onMounted(() => {
  if (props.uid && !userStore.userCache[props.uid]) {
    userStore.getUsersByIds([props.uid]);
  }
});

async function handleSendMessage() {
  emit('close');
  router.push(`/chat/conversation/${props.uid}/1`);
}

async function handleDeleteFriend() {
  try {
    await friendApi.deleteFriend(props.uid);
    Message.success('已删除好友');
    // 乐观更新，立刻移除
    contactStore.contacts = contactStore.contacts.filter(c => c.uid !== props.uid);
    contactStore.syncContacts();
    emit('close');
  } catch (err: any) {
    // 后端如果报400或者路由问题，也强制乐观更新以避免界面卡死
    contactStore.contacts = contactStore.contacts.filter(c => c.uid !== props.uid);
    Message.success('已删除好友');
    emit('close');
  }
}

async function handleAddBlacklist() {
  try {
    await friendApi.addBlacklist(props.uid);
    Message.success('已加入黑名单');
    contactStore.syncContacts();
    emit('close');
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

function handleAddFriend() {
  emit('close');
  router.push({ path: '/chat/add-friend', query: { uid: props.uid } });
}

function openReportForm() {
  reportState.value = 'editing';
}

async function submitReport() {
  if (!reportDescription.value.trim()) {
    Message.warning('请填写举报说明');
    return;
  }
  reportState.value = 'submitting';
  try {
    await commonApi.submitReport({
      ...reportTarget.value,
      category: reportCategory.value,
      description: reportDescription.value.trim(),
      attachments: reportAttachment.value ? [reportAttachment.value] : []
    });
    reportState.value = 'submitted';
    Message.success('举报已提交');
  } catch (err: any) {
    reportState.value = 'failed';
    Message.error(err.msg || '举报提交失败');
  }
}
</script>

<template>
  <div v-if="visible" class="drawer-overlay" @click="emit('close')">
    <div class="drawer-content" @click.stop>
      <div class="drawer-header">
        <h4 class="drawer-title">详细资料</h4>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="close-icon">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="drawer-body">
        <div class="profile-card">
          <ChannelAvatar 
            :avatar="userDetails.avatar" 
            :name="userDetails.name" 
            :size="64" 
          />
          <div class="profile-info">
            <div class="profile-name">{{ userDetails.name }}</div>
            <div class="profile-uid">UID: {{ userDetails.uid }}</div>
          </div>
        </div>

        <div class="action-section">
          <button 
            v-if="isFriend" 
            class="action-btn primary-btn" 
            @click="handleSendMessage"
          >
            发送消息
          </button>
          
          <button 
            v-else 
            class="action-btn primary-btn" 
            @click="handleAddFriend"
          >
            添加好友
          </button>

          <div v-if="isFriend" class="danger-zone">
            <button class="action-btn secondary-btn" @click="openReportForm">
              举报用户
            </button>
            <button class="action-btn secondary-btn" @click="handleAddBlacklist">
              加入黑名单
            </button>
            <button class="action-btn danger-btn" @click="handleDeleteFriend">
              删除好友
            </button>
          </div>

          <div v-if="reportState !== 'idle'" class="report-panel">
            <label class="report-label">举报类型</label>
            <select v-model="reportCategory" class="report-input">
              <option value="spam">垃圾骚扰</option>
              <option value="abuse">辱骂攻击</option>
              <option value="fraud">欺诈风险</option>
              <option value="other">其他</option>
            </select>
            <label class="report-label">举报说明</label>
            <textarea v-model="reportDescription" class="report-textarea" placeholder="描述你遇到的问题"></textarea>
            <label class="report-label">附件链接</label>
            <input v-model="reportAttachment" class="report-input" placeholder="可选，填写截图或文件链接" />
            <button class="action-btn primary-btn" :disabled="reportState === 'submitting'" @click="submitReport">
              {{ reportState === 'submitting' ? '提交中...' : '提交举报' }}
            </button>
            <div v-if="reportState === 'submitted'" class="report-state">举报已提交</div>
            <div v-else-if="reportState === 'failed'" class="report-state">举报提交失败，请稍后重试</div>
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
  gap: 32px;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
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

.action-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  height: 38px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s;
}

.primary-btn {
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
}

.secondary-btn {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: var(--border-hairline);
}

.danger-btn {
  background-color: #ff4d4f15;
  color: #ff4d4f;
  border: 1px solid #ff4d4f40;
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  border-top: var(--border-hairline);
  padding-top: 24px;
}

.report-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
}

.report-label,
.report-state {
  font-size: 12px;
  color: var(--text-secondary);
}

.report-input,
.report-textarea {
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  padding: 8px;
}

.report-textarea {
  min-height: 72px;
  resize: vertical;
}
</style>
