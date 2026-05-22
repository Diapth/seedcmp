import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertContains(name, content, pattern) {
  if (!pattern.test(content)) {
    throw new Error(`${name} is missing expected pattern: ${pattern}`);
  }
}

function assertNotContains(name, content, pattern) {
  if (pattern.test(content)) {
    throw new Error(`${name} still contains forbidden pattern: ${pattern}`);
  }
}

const mainLayout = read('apps/chat/src/layouts/MainLayout.vue');
const conversationList = read('apps/chat/src/views/ConversationList.vue');
const messageStore = read('packages/datasource-vue/src/stores/messageStore.ts');
const messageStoreJs = read('packages/datasource-vue/src/stores/messageStore.js');
const conversationStore = read('packages/datasource-vue/src/stores/conversationStore.ts');
const conversationStoreJs = read('packages/datasource-vue/src/stores/conversationStore.js');

assertNotContains(
  'MainLayout sidebar group creation entry',
  mainLayout,
  /goToCreateGroup|发起群聊|sidebar-actions|sidebar-action-btn|\/chat\/create-group/
);

assertContains(
  'ConversationList digest has typed fallback map',
  conversationList,
  /const digestFallbackByType[\s\S]*2:\s*'\[图片\]'[\s\S]*8:\s*'\[文件\]'[\s\S]*1000:\s*'\[系统消息\]'/
);

assertContains(
  'ConversationList digest extracts nested payload text',
  conversationList,
  /function resolveDigestText\([\s\S]*content\.contentObj[\s\S]*content\.payload[\s\S]*content\.text[\s\S]*content\.content/
);

assertContains(
  'ConversationList imports user store for group sender names',
  conversationList,
  /useUserStore[\s\S]*const userStore = useUserStore\(\)/
);

assertContains(
  'ConversationList prefixes group digests with sender name',
  conversationList,
  /function formatGroupDigest\([\s\S]*Number\(conv\.channel_type\) !== 2[\s\S]*getSenderName\(lastMessage\)[\s\S]*`\$\{senderName\}：\$\{digest\}`/
);

assertContains(
  'ConversationList prefixes group file digests with sender name',
  conversationList,
  /type === 8[\s\S]*return formatGroupDigest\(conv, lastMessage, `\$\{prefix\} \$\{text\}`\)/
);

assertContains(
  'messageStore selects latest non-system message for conversation digest',
  messageStore,
  /function isConversationDigestMessage\(msg: Message\)[\s\S]*!\[99, 1000\]\.includes\(type\)[\s\S]*function getLatestConversationDigestMessage\([\s\S]*\.reverse\(\)\.find\(isConversationDigestMessage\)/
);

assertContains(
  'messageStore JS selects latest non-system message for conversation digest',
  messageStoreJs,
  /function isConversationDigestMessage\(msg\)[\s\S]*!\[99, 1000\]\.includes\(type\)[\s\S]*function getLatestConversationDigestMessage\([\s\S]*\.reverse\(\)\.find\(isConversationDigestMessage\)/
);

assertContains(
  'messageStore skips realtime system messages as conversation summaries',
  messageStore,
  /if \(isConversationDigestMessage\(msg\)\) \{[\s\S]*conversationStore\.addOrUpdateConversation/
);

assertContains(
  'conversationStore prefers non-system recents for last message',
  conversationStore,
  /function getLastMessageSource\([\s\S]*find\(isConversationDigestSource\)[\s\S]*item\.recents\?\.\[0\]/
);

assertContains(
  'conversationStore JS prefers non-system recents for last message',
  conversationStoreJs,
  /function getLastMessageSource\([\s\S]*find\(isConversationDigestSource\)[\s\S]*item\.recents\?\.\[0\]/
);

assertNotContains(
  'ConversationList generic message placeholder',
  conversationList,
  /\[消息\]/
);

assertContains(
  'ConversationList clears unread on select',
  conversationList,
  /conversationStore\.clearUnread\(channelId, channelType\)/
);

assertContains(
  'ConversationList hides unread on active conversation',
  conversationList,
  /function getUnreadCount\([\s\S]*isActiveConversation\(conv\)[\s\S]*return 0/
);

assertContains(
  'ConversationList renders computed unread count',
  conversationList,
  /v-if="getUnreadCount\(conv\) > 0"[\s\S]*getUnreadCount\(conv\) > 99/
);

console.log('conversation list UI cleanup checks passed');
