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

const conversationStore = read('packages/datasource-vue/src/stores/conversationStore.ts');
const groupStore = read('packages/datasource-vue/src/stores/groupStore.ts');
const contactList = read('packages/contacts-vue/src/views/ContactList.vue');

assertContains(
  'conversationStore reads service recents as last message',
  conversationStore,
  /function getLastMessageSource\([\s\S]*item\.recents\?\.\[0\][\s\S]*item\.messages\?\.\[0\]/
);

assertContains(
  'conversationStore uses service timestamp for sorted summaries',
  conversationStore,
  /last_msg_time:[\s\S]*item\.timestamp/
);

assertContains(
  'conversationStore maps stick and extra fields',
  conversationStore,
  /top:[\s\S]*item\.stick[\s\S]*mute:[\s\S]*item\.mute/
);

assertContains(
  'groupStore exposes a saved group list',
  groupStore,
  /const savedGroups = computed/
);

assertContains(
  'groupStore accepts wrapped group list responses',
  groupStore,
  /res\?\.list[\s\S]*res\?\.groups/
);

assertContains(
  'contact list syncs saved groups',
  contactList,
  /groupStore\.fetchMyGroups\(\)/
);

assertContains(
  'contact list renders group chat entry',
  contactList,
  /saved-groups-section[\s\S]*群聊[\s\S]*handleGroupClick\(group\.group_no\)/
);

console.log('group chat and conversation summary checks passed');
