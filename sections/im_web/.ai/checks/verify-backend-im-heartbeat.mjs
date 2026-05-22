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

const conversationStore = read('packages/datasource-vue/src/stores/conversationStore.ts');
const sdkStore = read('packages/datasource-vue/src/stores/sdk.ts');
const userStore = read('packages/datasource-vue/src/stores/userStore.ts');
const loginStore = read('packages/login-vue/src/stores/loginStore.ts');
const chatView = read('apps/chat/src/views/ChatView.vue');

assertContains(
  'conversationStore debounces remote draft extra updates',
  conversationStore,
  /const draftSyncTimers = ref<Record<string,/
);

assertContains(
  'conversationStore skips unchanged remote draft extra updates',
  conversationStore,
  /if \(drafts\.value\[key\] === draftText\)/
);

assertContains(
  'conversationStore treats remote extra failures as non-blocking',
  conversationStore,
  /warnRemoteCommandFailure\('update conversation extra'/
);

assertContains(
  'conversationStore treats clearUnread failures as non-blocking',
  conversationStore,
  /warnRemoteCommandFailure\('clear unread'/
);

assertContains(
  'chat view awaits clearUnread to avoid unhandled rejections',
  chatView,
  /void conversationStore\.clearUnread\(channelId\.value, channelType\.value\)/
);

assertContains(
  'userStore sanitizes login device fields at auth boundary',
  userStore,
  /function sanitizeLoginCredentials/
);

assertContains(
  'loginStore keeps device model under backend varchar limit',
  loginStore,
  /const DEVICE_TEXT_MAX_LENGTH = 100/
);

assertNotContains(
  'sdkStore custom heartbeat ping loop',
  sdkStore,
  /sendPing\(\)/
);

assertNotContains(
  'sdkStore custom missed pong reconnect threshold',
  sdkStore,
  /missedPongs >= 3/
);

assertContains(
  'sdkStore relies on SDK reconnect and guards repeated connect attempts',
  sdkStore,
  /if \(connectionStatus\.value === ConnectStatus\.Connected\) \{[\s\S]*return;/
);

console.log('backend IM integration and heartbeat checks passed');
