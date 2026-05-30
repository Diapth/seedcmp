<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '@tsdaodao/contacts-vue';
import {
  groupApi,
  isClowderCatContactId,
  useClowderStore,
  useGroupStore,
  type ClowderCatContact
} from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const router = useRouter();
const contactStore = useContactStore();
const groupStore = useGroupStore();
const clowderStore = useClowderStore();

const groupName = ref('');
const selectedUids = ref<string[]>([]);
const creating = ref(false);
const inviteMode = ref<'direct' | 'approval'>('direct');

onMounted(() => {
  contactStore.syncContacts();
  clowderStore.loadCatContactDirectory({ includeUnavailable: true }).catch(() => undefined);
});

const mixedSelectableContacts = computed(() => {
  const humans = contactStore.contacts.map(contact => ({
    id: String(contact.uid),
    uid: String(contact.uid),
    name: contact.remark || contact.name,
    avatar: contact.avatar,
    type: 'human' as const,
    catContact: undefined as ClowderCatContact | undefined
  }));
  const cats = clowderStore.connectedCatContacts.map(cat => ({
    id: cat.id,
    uid: cat.id,
    name: cat.displayName,
    avatar: cat.avatar,
    type: 'cat' as const,
    catContact: cat
  }));
  return [...humans, ...cats];
});

const selectedCatContactIds = computed(() => selectedUids.value.filter(isClowderCatContactId));
const selectedHumanUids = computed(() => selectedUids.value.filter(uid => !isClowderCatContactId(uid)));

function toggleSelect(uid: string) {
  const idx = selectedUids.value.indexOf(uid);
  if (idx > -1) {
    selectedUids.value.splice(idx, 1);
  } else {
    selectedUids.value.push(uid);
  }
}

async function handleCreate() {
  const name = groupName.value.trim();
  if (!name) {
    Message.warning('请输入群聊名称');
    return;
  }
  if (selectedUids.value.length === 0) {
    Message.warning('请选择至少一个群成员');
    return;
  }
  if (selectedHumanUids.value.length === 0) {
    Message.warning('请选择至少一个真人联系人作为群成员');
    return;
  }

  creating.value = true;
  try {
    const res: any = await groupApi.createGroup({
      name,
      members: selectedHumanUids.value
    });
    
    const groupNo = res.data?.group_no || res.group_no;
    if (groupNo) {
      groupStore.upsertGroup(res.data || res);
      const selectedCats = clowderStore.connectedCatContacts.filter(cat => selectedCatContactIds.value.includes(cat.id));
      if (selectedCats.length > 0) {
        await clowderStore.syncMixedGroupCats({
          groupId: groupNo,
          groupName: name,
          humanMembers: contactStore.contacts
            .filter(contact => selectedHumanUids.value.includes(String(contact.uid)))
            .map(contact => ({
              id: String(contact.uid),
              displayName: contact.remark || contact.name || String(contact.uid),
              role: 'member',
              mentionHandle: `@${contact.remark || contact.name || contact.uid}`
            })),
          catMembers: selectedCats,
          rules: {
            proactiveReplies: false,
            privacy: 'Cats can see display names, roles, and mention handles only.'
          }
        });
      }
      if (inviteMode.value === 'approval') {
        await groupStore.updateGroupSetting(groupNo, { invite: 1 });
      }
      Message.success('群组创建成功');
      router.push(`/chat/conversation/${groupNo}/2`);
    } else {
      throw new Error('No group_no returned');
    }
  } catch (err: any) {
    Message.error(err.msg || '群组创建失败');
  } finally {
    creating.value = false;
  }
}

function handleGoBack() {
  router.push('/chat');
}
</script>

<template>
  <div class="create-group-page">
    <div class="page-header">
      <button class="back-btn" @click="handleGoBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="back-icon">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <h3 class="page-title">发起群聊</h3>
    </div>

    <div class="page-content">
      <!-- Input Group Name -->
      <div class="input-section">
        <label class="section-label">群聊名称</label>
        <input 
          v-model="groupName" 
          type="text" 
          placeholder="请输入群聊名称..." 
          class="name-input"
          :disabled="creating"
        />
      </div>

      <!-- Friend Selector -->
      <div class="selector-section">
        <label class="section-label">选择联系人 (已选 {{ selectedUids.length }}人，猫猫 {{ selectedCatContactIds.length }})</label>
        <div class="invite-mode-row">
          <button
            class="mode-btn"
            :class="{ active: inviteMode === 'direct' }"
            type="button"
            @click="inviteMode = 'direct'"
          >
            直接邀请
          </button>
          <button
            class="mode-btn"
            :class="{ active: inviteMode === 'approval' }"
            type="button"
            @click="inviteMode = 'approval'"
          >
            邀请确认
          </button>
        </div>
        <div class="flow-state-row">
          <span v-if="inviteMode === 'approval'">待审批</span>
          <span v-else>群二维码暂不可用，创建后可在群设置查看</span>
          <span class="muted-state">已过期状态会在二维码失效后显示</span>
        </div>
        
        <div class="friends-list-wrapper">
          <div v-if="mixedSelectableContacts.length === 0" class="empty-state">
            <p>暂无联系人可选择</p>
          </div>
          
          <div v-else class="friends-list">
            <div 
              v-for="member in mixedSelectableContacts" 
              :key="member.uid" 
              class="selector-item"
              :class="{ selected: selectedUids.includes(member.uid), 'is-clowder-cat': member.type === 'cat' }"
              @click="toggleSelect(member.uid)"
            >
              <div class="checkbox-wrapper">
                <div class="custom-checkbox"></div>
              </div>
              
              <ChannelAvatar 
                :avatar="member.avatar" 
                :name="member.name" 
                :size="36" 
              />
              
              <div class="selector-label">
                <span class="friend-name">{{ member.name }}</span>
                <span v-if="member.catContact?.id" class="clowder-cat-badge">猫猫</span>
                <span v-if="member.catContact?.capabilitySummary" class="cat-capability">{{ member.catContact.capabilitySummary }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <button 
        class="create-btn" 
        :disabled="creating || !groupName.trim() || selectedUids.length === 0"
        @click="handleCreate"
      >
        {{ creating ? '正在创建...' : '立即创建' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.create-group-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-primary);
}

.page-header {
  height: 64px;
  border-bottom: var(--border-hairline);
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  background-color: var(--bg-primary);
  flex-shrink: 0;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  background-color: var(--bg-hover);
}

.back-icon {
  width: 20px;
  height: 20px;
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.page-content {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.name-input {
  height: 38px;
  padding: 0 12px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.name-input:focus {
  border-color: var(--primary-color, #165dff);
}

.selector-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 200px;
}

.invite-mode-row {
  display: flex;
  gap: 8px;
}

.mode-btn {
  height: 30px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
}

.mode-btn.active {
  color: var(--primary-color, #165dff);
  border-color: var(--primary-color, #165dff);
  background: rgba(22, 93, 255, 0.08);
}

.flow-state-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-secondary);
}

.muted-state {
  color: var(--text-disabled, #9ca3af);
}

.friends-list-wrapper {
  flex: 1;
  overflow-y: auto;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.friends-list {
  display: flex;
  flex-direction: column;
}

.selector-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: var(--border-hairline);
}

.selector-item:hover {
  background-color: var(--bg-hover);
}

.checkbox-wrapper {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-checkbox {
  width: 16px;
  height: 16px;
  border: 1px solid var(--text-secondary);
  border-radius: 2px;
  position: relative;
  transition: border-color 0.2s, background-color 0.2s;
}

.selector-item.selected .custom-checkbox {
  border-color: var(--primary-color, #165dff);
  background-color: var(--primary-color, #165dff);
}

.selector-item.selected .custom-checkbox::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid #ffffff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.selector-item.is-clowder-cat {
  background: rgba(15, 118, 110, 0.04);
}

.selector-label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.clowder-cat-badge {
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  padding: 1px 5px;
  color: #0f766e;
  background: rgba(15, 118, 110, 0.1);
  font-size: 10px;
  font-weight: 600;
}

.cat-capability {
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.create-btn {
  height: 40px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.create-btn:hover {
  opacity: 0.9;
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
