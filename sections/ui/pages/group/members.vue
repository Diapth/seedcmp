<template>
  <AppSubpageShell>
    <view class="group-members-page flex-column flex-1">

      <!-- Header -->
      <view class="header flex-row align-center justify-between">
        <view class="header-left flex-row align-center">
          <view class="back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
          <text class="title">群成员 ({{ filteredMembers.length }})</text>
        </view>
        <view class="header-actions flex-row align-center">
          <button class="btn-qr" @click="goQrCode">
            <AppIcon name="grid" :size="16" color="var(--color-primary)" />
            <text class="btn-qr-text">二维码</text>
          </button>
          <button class="btn-add-member" @click="showAddDialog = true">
            <AppIcon name="plus" :size="16" color="#ffffff" />
            <text class="btn-text">添加</text>
          </button>
        </view>
      </view>

      <!-- Search -->
      <view class="search-box glass-panel">
        <view class="search-inner flex-row align-center">
          <AppIcon name="search" :size="16" color="var(--color-text-muted)" class="search-icon" />
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索群成员..."
            class="search-input flex-1"
          />
        </view>
      </view>

      <!-- Scrollable list -->
      <scroll-view scroll-y class="members-scroll flex-1">
        <view class="members-list" v-if="filteredMembers.length > 0">
          <view
            v-for="item in filteredMembers"
            :key="item.id"
            class="member-item flex-row align-center justify-between"
            @contextmenu.prevent="openContextMenu(item, $event)"
            @longpress="openContextMenu(item, $event)"
          >
            <view class="member-info flex-row align-center gap-3">
              <AppAvatar :src="item.avatar" :text="item.nickname" :size="40" />
              <view class="name-box flex-column">
                <text class="nickname">{{ item.nickname }}</text>
                <text class="role-badge" :class="item.role">{{ getRoleText(item.role) }}</text>
              </view>
            </view>
            <button
              class="btn-kick"
              v-if="item.role !== 'owner' && item.id !== 'me'"
              @click.stop="handleRemove(item)"
            >
              移出
            </button>
          </view>
        </view>

        <!-- Empty -->
        <view class="empty-padding" v-else>
          <AppEmptyState icon="search" title="无匹配的成员" />
        </view>
      </scroll-view>

      <!-- Add Member Dialog -->
      <AppDialog
        v-model:visible="showAddDialog"
        title="邀请新成员"
        @confirm="handleAddConfirm"
        @cancel="showAddDialog = false"
      >
        <view class="add-dialog-content flex-column">
          <text class="dialog-tip">请选择要邀请加入群聊的联系人：</text>
          <scroll-view scroll-y class="dialog-scroll">
            <view class="dialog-list" v-if="availableContacts.length > 0">
              <view
                v-for="c in availableContacts"
                :key="c.id"
                class="dialog-item flex-row align-center justify-between"
                @click="toggleSelect(c.id)"
              >
                <view class="dialog-item-left flex-row align-center gap-2">
                  <AppAvatar :src="c.avatar" :text="c.nickname" :size="32" />
                  <text class="dialog-name">{{ c.nickname }}</text>
                </view>
                <view class="checkbox" :class="{ checked: selectedContacts.includes(c.id) }">
                  <AppIcon name="check" :size="12" color="#ffffff" v-if="selectedContacts.includes(c.id)" />
                </view>
              </view>
            </view>
            <view v-else class="dialog-empty">
              <text class="dialog-empty-text">所有好友均已加入群聊</text>
            </view>
          </scroll-view>
        </view>
      </AppDialog>

      <!-- 右键/长按菜单 (PR-10) -->
      <AppContextMenu
        v-model:visible="ctxMenu.visible.value"
        :x="ctxMenu.x.value"
        :y="ctxMenu.y.value"
        :is-desktop="ctxMenu.isDesktop.value"
        :items="ctxMenuItems"
        @select="handleCtxAction"
      />

      <!-- 备注修改弹窗 -->
      <AppDialog
        v-model:visible="remarkDialog.visible"
        :title="`修改 ${remarkDialog.target?.nickname || ''} 的备注`"
        @confirm="confirmRemark"
      >
        <view class="flex-column" style="gap: 8px;">
          <text class="dialog-tip">新备注：</text>
          <input v-model="remarkDialog.value" class="remark-input" placeholder="请输入备注" />
        </view>
      </AppDialog>

      <!-- 资料查看 (ContactCard 复用作 bottom-sheet) -->
      <AppDialog
        v-model:visible="cardDialog.visible"
        variant="bottom-sheet"
        :show-cancel="false"
        confirm-text="关闭"
      >
        <ContactCard v-if="cardDialog.contact" :contact="cardDialog.contact" />
      </AppDialog>

    </view>
  </AppSubpageShell>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useContactStore } from '@/stores/contact';
import { useConversationStore } from '@/stores/conversation';
import { useGroupStore } from '@/stores/group';
import { useAgentStore } from '@/stores/agent';
import { useNavigationStore } from '@/stores/navigation';
import { useContextMenu } from '@/composables/useContextMenu';
import { useConfirm } from '@/composables/useConfirm';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';
import AppDialog from '@/components/common/AppDialog.vue';
import AppContextMenu from '@/components/common/AppContextMenu.vue';
import ContactCard from '@/components/contacts/ContactCard.vue';

const contactStore = useContactStore();
const convStore = useConversationStore();
const groupStore = useGroupStore();
const agentStore = useAgentStore();
const navStore = useNavigationStore();
const ctxMenu = useContextMenu();
const ctxTarget = ref(null);
const { confirm } = useConfirm();

onMounted(() => {
  navStore.setActiveModule('contacts');
  if (!convStore.members['2'] || convStore.members['2'].length === 0) {
    convStore.initFromGroupMembers(
      '2',
      [
        { id: 'me', nickname: '我', avatar: '', role: 'owner' },
        { id: '1', nickname: '张伟', avatar: '', role: 'admin' },
        { id: '4', nickname: '李四', avatar: '', role: 'member' },
        { id: '5', nickname: '王五', avatar: '', role: 'member' }
      ],
      'me'
    );
  }
  if (!groupStore.groups.find((g) => g.id === '2')) {
    groupStore.addGroup({
      id: '2',
      name: 'AgentHub 产品研发群',
      avatar: '',
      memberCount: 4,
      announcement: '欢迎来到 AgentHub 产品研发群',
      creatorId: 'me',
      createTime: 1780300000000
    });
  }
});

const searchQuery = ref('');
const showAddDialog = ref(false);
const selectedContacts = ref([]);

const members = computed(() => convStore.groupMembers('2'));

const filteredMembers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return members.value;
  return members.value.filter((m) => m.nickname.toLowerCase().includes(query));
});

const availableContacts = computed(() => {
  const contacts = contactStore.contacts
    .filter((c) => !members.value.some((m) => m.id === c.id))
    .map((contact) => ({ ...contact, inviteType: 'contact' }));
  const agents = agentStore.agents
    .filter((agent) => !members.value.some((m) => m.id === agent.id))
    .map((agent) => ({
      id: `agent:${agent.id}`,
      agentId: agent.id,
      nickname: agent.name,
      avatar: agent.avatar,
      inviteType: 'agent',
      alias: agent.alias
    }));
  return [...agents, ...contacts];
});

function getRoleText(role) {
  if (role === 'owner') return '群主';
  if (role === 'admin') return '管理员';
  return '成员';
}

function goBack() {
  uni.navigateBack();
}

function goQrCode() {
  uni.navigateTo({ url: '/pages/group/qrcode' });
}

function handleRemove(item) {
  // PR-15: 替换为 useConfirm
  confirm(`确定要将 ${item.nickname} 移出群聊吗？`, {
    title: '移出群成员',
    destructive: true
  }).then((ok) => {
    if (ok) {
      convStore.removeMember('2', item.id);
      uni.showToast({ title: '已成功移出', icon: 'success' });
    }
  });
}

function toggleSelect(id) {
  const index = selectedContacts.value.indexOf(id);
  if (index === -1) selectedContacts.value.push(id);
  else selectedContacts.value.splice(index, 1);
}

function handleAddConfirm() {
  if (selectedContacts.value.length === 0) {
    showAddDialog.value = false;
    return;
  }
  selectedContacts.value.forEach((id) => {
    if (id.startsWith('agent:')) {
      const agentId = id.slice('agent:'.length);
      const agent = agentStore.agents.find((item) => item.id === agentId);
      if (agent) convStore.addAgentMember('2', agent);
      return;
    }
    const contact = contactStore.contacts.find((c) => c.id === id);
    if (contact) {
      convStore.addMember('2', {
        id: contact.id,
        nickname: contact.nickname,
        avatar: contact.avatar,
        role: 'member'
      });
    }
  });
  selectedContacts.value = [];
  showAddDialog.value = false;
  uni.showToast({ title: '邀请已发送，成员已加入', icon: 'success' });
}

function openContextMenu(item, event) {
  ctxTarget.value = item;
  ctxMenu.show(event, item);
}

const ctxMenuItems = computed(() => {
  const m = ctxTarget.value;
  if (!m) return [];
  const isSelf = m.id === 'me';
  const isAdmin = m.role === 'admin';
  const items = [
    {
      label: '@ 他',
      icon: 'chat',
      onClick: () => atMember(m)
    },
    {
      label: '查看资料',
      icon: 'user',
      onClick: () => openCardDialog(m)
    }
  ];
  if (!isSelf) {
    items.push({
      label: '修改备注',
      icon: 'edit',
      onClick: () => openRemarkDialog(m)
    });
  }
  if (m.role !== 'owner' && !isSelf) {
    items.push({
      label: '移出群聊',
      icon: 'exit',
      danger: true,
      onClick: () => handleRemove(m)
    });
  }
  return items;
});

function handleCtxAction(item) {
  if (item.onClick) item.onClick();
}

function atMember(m) {
  // 移动端长按: 跳转到 chat detail 并带 at 参数
  // #ifdef H5
  if (ctxMenu.isDesktop.value) {
    // 桌面: 直接打开 chat 详情并预填 @nickname
    uni.setStorageSync(`at:${'2'}`, m.id);
  }
  // #endif
  // 桌面 + 移动统一通过 query 参数跳转
  uni.navigateTo({
    url: `/pages/chat/detail?id=2&at=${m.id}`
  });
}

const remarkDialog = ref({ visible: false, target: null, value: '' });
function openRemarkDialog(m) {
  remarkDialog.value = { visible: true, target: m, value: '' };
}
function confirmRemark() {
  const t = remarkDialog.value.target;
  if (t) {
    // 备注存到 contact store (按 id 找到 contact, 写 remark)
    contactStore.updateRemark(t.id, remarkDialog.value.value);
  }
  remarkDialog.value.visible = false;
  uni.showToast({ title: '已保存备注', icon: 'success' });
}

const cardDialog = ref({ visible: false, contact: null });
function openCardDialog(m) {
  // 优先在 contacts 中找完整资料
  const c = contactStore.contacts.find((x) => x.id === m.id) || {
    id: m.id,
    nickname: m.nickname,
    avatar: m.avatar,
    phone: '',
    pinyin: m.nickname,
    remark: '',
    status: 'offline'
  };
  cardDialog.value = { visible: true, contact: c };
}
</script>

<style scoped>
.group-members-page {
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

.header-actions {
  gap: 8px;
  display: flex;
}

.btn-qr {
  min-height: 44px;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  cursor: pointer;
}
.btn-qr::after { border: none; }

.btn-qr-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.btn-add-member {
  min-height: 44px;
  background-color: var(--color-primary);
  border-radius: 8px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  margin: 0;
  cursor: pointer;
}
.btn-add-member::after { border: none; }

.btn-text {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.search-box {
  margin: 12px 16px;
  padding: 8px 12px;
  border-radius: 8px;
}

.search-inner {
  gap: 8px;
}

.search-input {
  height: 24px;
  font-size: 14px;
  color: var(--color-text-primary);
  border: none;
}

.members-scroll {
  height: 100%;
}

.members-list {
  background-color: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
}

.member-item {
  height: 58px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  display: flex;
}

.gap-3 {
  gap: 12px;
}

.member-info {
  display: flex;
  align-items: center;
}

.name-box {
  gap: 2px;
}

.nickname {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.role-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  align-self: flex-start;
}
.role-badge.owner {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}
.role-badge.admin {
  background-color: var(--color-bg-muted);
  color: var(--color-text-secondary);
}
.role-badge.member {
  background-color: transparent;
  color: var(--color-text-muted);
  padding: 0;
}

.btn-kick {
  min-height: 44px;
  padding: 0 14px;
  background-color: var(--color-bg-base);
  color: var(--color-error);
  border: 1px solid var(--color-error);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.btn-kick::after { border: none; }

.empty-padding {
  padding-top: 40px;
}

.add-dialog-content {
  gap: 12px;
}

.dialog-tip {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.dialog-scroll {
  max-height: 200px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.dialog-list {
  background-color: var(--color-bg-surface);
}

.dialog-item {
  height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
}
.dialog-item:last-child {
  border-bottom: none;
}

.gap-2 {
  gap: 8px;
}

.dialog-item-left {
  display: flex;
  align-items: center;
}

.dialog-name {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.checkbox.checked {
  border-color: var(--color-primary);
  background-color: var(--color-primary);
}

.dialog-empty {
  padding: 24px;
  text-align: center;
}

.dialog-empty-text {
  font-size: 13px;
  color: var(--color-text-muted);
}

.remark-input {
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  font-size: 14px;
  background-color: var(--color-bg-base);
}
</style>
