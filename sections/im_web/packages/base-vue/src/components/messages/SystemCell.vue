<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    content?: {
      text?: string;
    };
    [key: string]: any;
  };
}>();

const displayText = computed(() => {
  const content = props.message.content || props.message.payload || {};
  if (content.text) return content.text;

  const eventName = content.event || content.type_name || content.action || content.cmd;
  const operator = content.operator_name || content.operatorName || content.inviter_name || content.from_name || '有人';
  const members = content.members || content.uids || [];
  const memberText = Array.isArray(members)
    ? members.map((member: any) => member.name || member.uid || member).join('、')
    : String(members || '');

  switch (eventName) {
    case 'group_create':
    case 'GroupCreate':
      return `${operator} 创建了群聊`;
    case 'group_member_add':
    case 'GroupMemberAdd':
      return memberText ? `${operator} 邀请 ${memberText} 加入群聊` : `${operator} 邀请新成员加入群聊`;
    case 'group_member_remove':
    case 'GroupMemberRemove':
      return memberText ? `${operator} 将 ${memberText} 移出群聊` : `${operator} 移出了群成员`;
    case 'group_exit':
    case 'GroupExit':
      return `${operator} 退出了群聊`;
    case 'group_update':
    case 'GroupUpdate':
      return `${operator} 更新了群资料`;
    case 'group_disband':
    case 'GroupDisband':
      return `${operator} 解散了群聊`;
    default:
      return '系统通知';
  }
});
</script>

<template>
  <div class="system-cell">
    <div class="system-bubble">
      {{ displayText }}
    </div>
  </div>
</template>

<style scoped>
.system-cell {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 8px 0;
}

.system-bubble {
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: var(--border-hairline);
  max-width: 80%;
  text-align: center;
  word-break: break-all;
}
</style>
