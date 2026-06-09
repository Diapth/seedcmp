<template>
  <AppSubpageShell>
    <view class="create-group-page flex-column flex-1">
      
      <!-- Header -->
      <view class="header flex-row align-center justify-between">
        <view class="header-left flex-row align-center">
          <view class="back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
          <text class="title">发起群聊</text>
        </view>
        <button 
          class="btn-submit" 
          :disabled="selectedMemberIds.length === 0 || !groupName.trim()" 
          @click="handleCreate"
        >
          确定({{ selectedMemberIds.length }})
        </button>
      </view>
      
      <!-- Group Info Form -->
      <view class="form-section glass-panel">
        <view class="input-row flex-row align-center">
          <text class="label">群聊名称</text>
          <input 
            type="text" 
            v-model="groupName" 
            placeholder="请输入群聊名称..." 
            class="group-name-input flex-1"
            placeholder-style="color: var(--color-text-muted)"
          />
        </view>
      </view>
      
      <text class="section-title">选择联系人和智能体</text>
      
      <!-- Friends List -->
      <scroll-view scroll-y class="friends-scroll flex-1">
        <view class="friends-list" v-if="selectableMembers.length > 0">
          <view 
            v-for="item in selectableMembers" 
            :key="item.id"
            class="friend-item flex-row align-center justify-between"
            :class="{ agent: item.inviteType === 'agent' }"
            @click="toggleSelect(item.id)"
          >
            <view class="friend-info flex-row align-center gap-3">
              <AppAvatar :src="item.avatar" :text="item.nickname" :size="40" />
              <view class="name-box flex-column">
                <view class="name-line flex-row align-center gap-2">
                  <text class="nickname">{{ item.nickname }}</text>
                  <text v-if="item.inviteType === 'agent'" class="type-badge">智能体</text>
                </view>
                <text v-if="item.inviteType === 'agent'" class="member-meta">
                  {{ item.alias || item.platform || 'Agent' }}
                </text>
              </view>
            </view>
            <view class="checkbox" :class="{ checked: selectedMemberIds.includes(item.id) }">
              <AppIcon name="check" :size="14" color="#ffffff" v-if="selectedMemberIds.includes(item.id)" />
            </view>
          </view>
        </view>
        
        <!-- Empty Contacts -->
        <view class="empty-padding" v-else>
          <AppEmptyState icon="user" title="暂无可选择的联系人或智能体" />
        </view>
      </scroll-view>
      
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useContactStore } from '@/stores/contact';
import { useMessageStore } from '@/stores/message';
import { useNavigationStore } from '@/stores/navigation';
import { useGroupStore } from '@/stores/group';
import { useConversationStore } from '@/stores/conversation';
import { useAgentStore } from '@/stores/agent';
import {
  buildSelectableGroupMembers,
  splitSelectedGroupMembers
} from '@/services/native-im/group-member-candidates';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';

const contactStore = useContactStore();
const agentStore = useAgentStore();
const msgStore = useMessageStore();
const navStore = useNavigationStore();
const groupStore = useGroupStore();
const convStore = useConversationStore();

onMounted(() => {
  // Group subpages are currently attached to the contacts module (no group tab in MobileTabBar).
  navStore.setActiveModule('contacts');
  contactStore.syncNativeContacts({ silent: true }).catch(() => undefined);
  agentStore.fetchNativeAgents({ silent: true, clearStatic: false }).catch(() => undefined);
});

const groupName = ref('');
const selectedMemberIds = ref([]);

const selectableMembers = computed(() => buildSelectableGroupMembers({
  contacts: contactStore.contacts,
  agents: agentStore.agents
}));

function goBack() {
  uni.navigateBack();
}

function toggleSelect(id) {
  const index = selectedMemberIds.value.indexOf(id);
  if (index === -1) {
    selectedMemberIds.value.push(id);
  } else {
    selectedMemberIds.value.splice(index, 1);
  }
}

async function handleCreate() {
  const name = groupName.value.trim();
  if (!name) {
    uni.showToast({ title: '请输入群聊名称', icon: 'none' });
    return;
  }
  
  if (selectedMemberIds.value.length === 0) {
    uni.showToast({ title: '请选择群成员', icon: 'none' });
    return;
  }
  
  try {
    const selected = splitSelectedGroupMembers(selectedMemberIds.value, selectableMembers.value);
    const { group, conversation } = await groupStore.createNativeGroup({
      name,
      memberIds: selected.contactIds
    });
    const groupId = conversation?.id || group.id;
    let agentSyncFailed = false;
    if (selected.agents.length > 0) {
      try {
        await groupStore.syncGroupCatsForGroup({
          groupId,
          groupName: name,
          agents: selected.agents
        });
      } catch (error) {
        agentSyncFailed = true;
        console.warn('[group/create] sync group cats failed', error);
      }
      selected.agents.forEach((agent) => {
        convStore.addAgentMember(groupId, agent);
      });
    }
    convStore.setActiveId(groupId);
    msgStore.messages[groupId] = msgStore.messages[groupId] || [
      {
        id: Date.now().toString(),
        senderId: 'system',
        senderName: '系统',
        content: `你创建了群聊 "${name}"`,
        type: 'system',
        time: Date.now(),
        status: 'success'
      }
    ];
    uni.showToast({
      title: agentSyncFailed ? '群聊已创建，智能体同步稍后重试' : '群聊创建成功',
      icon: agentSyncFailed ? 'none' : 'success'
    });
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/chat/detail?id=${groupId}` });
    }, 500);
  } catch (error) {
    uni.showToast({ title: error?.msg || error?.message || '群聊创建失败', icon: 'none' });
  }
}
</script>

<style scoped>
.create-group-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.header {
  height: 56px;
  padding: 0 16px;
  background-color: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
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
  flex-shrink: 0;
}

.title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.btn-submit {
  min-height: 44px;
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border: none;
  cursor: pointer;
}
.btn-submit:disabled {
  background-color: var(--color-bg-muted);
  color: var(--color-text-muted);
  cursor: not-allowed;
}
.btn-submit::after { border: none; }

.form-section {
  margin: 16px;
  padding: 12px 16px;
  border-radius: 12px;
}

.input-row {
  height: 44px;
  gap: 16px;
}

.label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  width: 70px;
}

.group-name-input {
  height: 100%;
  border: none;
  font-size: 15px;
  color: var(--color-text-primary);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-left: 20px;
  margin-bottom: 8px;
}

.friends-scroll {
  height: 100%;
}

.friends-list {
  background-color: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
}

.friend-item {
  min-height: 58px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  background-color: var(--color-bg-surface);
  transition: background-color 0.2s ease;
  display: flex;
}
.friend-item:hover {
  background-color: var(--color-bg-hover);
}
.friend-item.agent {
  background-color: rgba(0, 74, 198, 0.03);
}

.gap-3 {
  gap: 12px;
}
.gap-2 {
  gap: 8px;
}

.friend-info {
  display: flex;
  align-items: center;
  min-width: 0;
}

.name-box {
  min-width: 0;
}

.name-line {
  display: flex;
  align-items: center;
  min-width: 0;
}

.nickname {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 6px;
  background-color: rgba(0, 74, 198, 0.1);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
}

.member-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.checkbox.checked {
  border-color: var(--color-primary);
  background-color: var(--color-primary);
}

.empty-padding {
  padding-top: 40px;
}
</style>
