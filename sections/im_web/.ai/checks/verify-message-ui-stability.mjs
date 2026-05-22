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

const messageList = read('apps/chat/src/components/MessageList.vue');
const messageStore = read('packages/datasource-vue/src/stores/messageStore.ts');
const cmdListeners = read('packages/datasource-vue/src/cmd/index.ts');
const textCell = read('packages/base-vue/src/components/messages/TextCell.vue');
const contactStore = read('packages/contacts-vue/src/stores/contactStore.ts');

assertContains(
  'MessageList supported content filter',
  messageList,
  /const renderableMessages = computed\(\(\) =>[\s\S]*isRenderableMessage/
);

assertContains(
  'MessageList skips unknown messages',
  messageList,
  /v-for="\(\msg, idx\) in renderableMessages"/
);

assertNotContains(
  'MessageList unknown fallback SystemCell',
  messageList,
  /<SystemCell\s*\n\s*v-else\s*\n\s*:message="msg"/
);

assertNotContains(
  'MessageList read receipt label',
  messageList,
  /read-status|已读|未读|readedCount|readed/
);

assertContains(
  'TextCell stable bubble width',
  textCell,
  /\.bubble\s*\{[\s\S]*display: inline-block;[\s\S]*width: fit-content;[\s\S]*max-width: min\(520px, 100%\);/
);

assertContains(
  'contactStore sync request id guard',
  contactStore,
  /let contactSyncRequestId = 0/
);

assertContains(
  'contactStore preserves contacts on empty incremental response',
  contactStore,
  /if \(list\.length === 0\) \{[\s\S]*return;[\s\S]*\}/
);

assertNotContains(
  'messageStore sendMessage duplicate local temp clientMsgNo',
  messageStore,
  /const clientMsgNo = Math\.random\(\)\.toString\(36\)\.substring\(7\)/
);

assertNotContains(
  'messageStore sendMessage duplicate optimistic add before SDK send',
  messageStore,
  /addMessage\(channelId, channelType, tempMsg\);\s*try\s*\{/
);

assertContains(
  'messageStore sendMessage upserts SDK returned message',
  messageStore,
  /const res = await WKSDK\.shared\(\)\.chatManager\.send\(textMsg, channel\);[\s\S]*addRealtimeMessage\(channelId, channelType, res\)/
);

assertContains(
  'messageStore exposes SDK ack status updater',
  messageStore,
  /function updateMessageStatus\(clientMsgNo: string, patch: Partial<Message>\)/
);

assertContains(
  'cmd listeners remember SDK clientSeq mapping before ACK',
  cmdListeners,
  /pendingClientMsgNoBySeq\.set\(message\.clientSeq, message\.clientMsgNo\)/
);

assertContains(
  'cmd listeners update sent message by clientMsgNo on ACK',
  cmdListeners,
  /messageStore\.updateMessageStatus\(clientMsgNo,/
);

console.log('message UI stability checks passed');
