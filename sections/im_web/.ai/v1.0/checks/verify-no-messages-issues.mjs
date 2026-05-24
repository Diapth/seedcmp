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

const messageStore = read('packages/datasource-vue/src/stores/messageStore.ts');
const userStore = read('packages/datasource-vue/src/stores/userStore.ts');
const sdkStore = read('packages/datasource-vue/src/stores/sdk.ts');
const cmdIndex = read('packages/datasource-vue/src/cmd/index.ts');

assertContains(
  'messageStore payload object decoder',
  messageStore,
  /function normalizeSyncedPayload\([\s\S]*typeof payload === 'object'[\s\S]*return normalizeMessageContent\(payload\)/
);

assertContains(
  'messageStore text content normalization',
  messageStore,
  /function normalizeMessageContent\([\s\S]*normalized\.type === 1[\s\S]*normalized\.text = normalized\.content/
);

assertNotContains(
  'messageStore object payload unsafe atob',
  messageStore,
  /JSON\.parse\(atob\(item\.payload\)\)/
);

assertContains(
  'messageStore deleted message filter',
  messageStore,
  /\.filter\(\(item: any\) => item\.is_deleted !== 1\)/
);

assertContains(
  'userStore restores SDK',
  userStore,
  /sdkStore\.initializeSDK\(currentUser\.value\.uid, storedToken\)/
);

assertContains(
  'sdkStore idempotent initialization',
  sdkStore,
  /if \(initializedUid === uid && initializedToken === token && connectionStatus\.value !== ConnectStatus\.Disconnect\)/
);

assertContains(
  'realtime listener ignores noPersist messages',
  cmdIndex,
  /message\.header\?\.noPersist/
);

console.log('no-messages issue checks passed');
