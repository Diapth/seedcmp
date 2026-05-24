import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { imWebRoot } from './paths.mjs';

const root = imWebRoot;

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

const conversationStore = read('packages/datasource-vue/src/stores/conversationStore.ts');
const messageStore = read('packages/datasource-vue/src/stores/messageStore.ts');
const conversationList = read('apps/chat/src/views/ConversationList.vue');

assertContains(
  'conversationStore upsert helper',
  conversationStore,
  /function upsertConversation\([\s\S]*Object\.assign\(conv,/
);

assertContains(
  'conversationStore normalizes conversation channel keys',
  conversationStore,
  /function normalizeConversationInput\([\s\S]*channel_type: Number\(/
);

assertContains(
  'conversationStore finds conversations by normalized key',
  conversationStore,
  /function findConversation\([\s\S]*String\(c\.channel_id\) === channelId[\s\S]*Number\(c\.channel_type\) === channelType/
);

assertContains(
  'conversationStore compacts duplicate normalized conversations',
  conversationStore,
  /function compactConversations\([\s\S]*merged\.set\(key,/
);

assertContains(
  'conversationStore renders unique sorted conversations',
  conversationStore,
  /const uniqueConversations = computed/
);

assertContains(
  'conversationStore normalizes synced last message payload',
  conversationStore,
  /function normalizeLastMessage\([\s\S]*getLastMessageSource\(item\)/
);

assertContains(
  'conversationStore skips system messages when choosing synced last message',
  conversationStore,
  /function getLastMessageSource\([\s\S]*find\(isConversationDigestSource\)/
);

assertNotContains(
  'conversationStore destructive sync replace',
  conversationStore,
  /conversations\.value = list;/
);

assertContains(
  'messageStore retains conversation after history sync',
  messageStore,
  /ensureConversationFromMessages\(channelId, channelType\)/
);

assertContains(
  'conversationStore tracks manual deletions',
  conversationStore,
  /manuallyDeletedConversationKeys/
);

assertContains(
  'conversationStore skips manually deleted sync entries',
  conversationStore,
  /if \(manuallyDeletedConversationKeys\.value\[key\]\) return/
);

assertContains(
  'conversationStore reopens conversation on new activity',
  conversationStore,
  /delete manuallyDeletedConversationKeys\.value\[key\]/
);

assertContains(
  'conversationList context menu state',
  conversationList,
  /selectedConversation/
);

assertContains(
  'conversationList right click delete',
  conversationList,
  /@contextmenu\.prevent="handleConversationContextMenu\(\$event, conv\)"/
);

assertContains(
  'conversationList manual delete action',
  conversationList,
  /conversationStore\.deleteConversation\(selectedConversation\.value\.channel_id, selectedConversation\.value\.channel_type\)/
);

console.log('conversation retention checks passed');
