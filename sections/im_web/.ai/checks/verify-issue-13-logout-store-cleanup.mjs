import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const userStore = read('packages/datasource-vue/src/stores/userStore.ts');
const groupStore = read('packages/datasource-vue/src/stores/groupStore.ts');
const channelStore = read('packages/datasource-vue/src/stores/channelStore.ts');
const conversationStore = read('packages/datasource-vue/src/stores/conversationStore.ts');
const messageStore = read('packages/datasource-vue/src/stores/messageStore.ts');
const contactStore = read('packages/contacts-vue/src/stores/contactStore.ts');

assert.match(
  userStore,
  /useChannelStore\(\)\.reset\(\)/,
  'userStore logout should trigger channelStore reset'
);

assert.match(
  userStore,
  /useGroupStore\(\)\.reset\(\)/,
  'userStore logout should trigger groupStore reset'
);

assert.match(
  userStore,
  /useConversationStore\(\)\.reset\(\)/,
  'userStore logout should trigger conversationStore reset'
);

assert.match(
  userStore,
  /useMessageStore\(\)\.reset\(\)/,
  'userStore logout should trigger messageStore reset'
);

assert.match(
  userStore,
  /dispatchEvent\(new CustomEvent\('tsdaodao:logout'\)\)/,
  'userStore logout should dispatch tsdaodao:logout custom event globally'
);

assert.match(
  groupStore,
  /function reset\(\)/,
  'groupStore should export a reset function'
);

assert.match(
  channelStore,
  /function reset\(\)/,
  'channelStore should export a reset function'
);
assert.match(
  channelStore,
  /resetVersion/,
  'channelStore should guard async writes with a reset generation'
);

assert.match(
  conversationStore,
  /function reset\(\)/,
  'conversationStore should export a reset function'
);
assert.match(
  conversationStore,
  /resetVersion/,
  'conversationStore should guard async writes with a reset generation'
);
assert.match(
  conversationStore,
  /if\s*\(\s*version\s*!==\s*resetVersion\.value\s*\)\s*return/,
  'conversationStore async sync should drop stale responses after reset'
);

assert.match(
  messageStore,
  /function reset\(\)/,
  'messageStore should export a reset function'
);
assert.match(
  messageStore,
  /resetVersion/,
  'messageStore should guard async writes with a reset generation'
);

assert.match(
  contactStore,
  /function reset\(\)/,
  'contactStore should export a reset function'
);
assert.match(
  contactStore,
  /contactSyncRequestId\+\+/,
  'contactStore reset should invalidate in-flight contact sync requests'
);
assert.match(
  contactStore,
  /friendRequestRequestId/,
  'contactStore should guard in-flight friend request loads across logout'
);
assert.match(
  contactStore,
  /blacklistRequestId/,
  'contactStore should guard in-flight blacklist loads across logout'
);

assert.match(
  contactStore,
  /window\.addEventListener\('tsdaodao:logout'/,
  'contactStore should listen to tsdaodao:logout custom event to auto-reset'
);

console.log('issue 13 logout store cleanup checks passed');
