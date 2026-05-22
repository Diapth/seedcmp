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

const contactStore = read('packages/contacts-vue/src/stores/contactStore.ts');
const addFriendPage = read('packages/contacts-vue/src/views/AddFriendPage.vue');
const sdkStore = read('packages/datasource-vue/src/stores/sdk.ts');
const cmdIndex = read('packages/datasource-vue/src/cmd/index.ts');

assertContains(
  'contactStore syncContacts',
  contactStore,
  /contacts\.value\s*=\s*list\.filter\([\s\S]*?is_deleted\s*!==\s*1\s*&&[\s\S]*?follow\s*===\s*1/
);

assertContains(
  'AddFriendPage search response',
  addFriendPage,
  /res\s*&&\s*res\.exist\s*===\s*1\s*&&\s*res\.data/
);

assertContains(
  'AddFriendPage result assignment',
  addFriendPage,
  /result\.value\s*=\s*userData/
);

assertContains(
  'AddFriendPage existing friend guard',
  addFriendPage,
  /userData\.follow\s*===\s*1/
);

assertContains(
  'SDK connect address',
  sdkStore,
  /apiClient\.get\(`users\/\$\{uid\}\/im`\)/
);

assertContains(
  'CMD friendRequest event',
  cmdIndex,
  /case\s+'friendRequest':[\s\S]*wksdk:friendRequest/
);

assertContains(
  'realtime message listener',
  cmdIndex,
  /export function registerMessageListeners\(\)[\s\S]*addRealtimeMessage/
);

console.log('base issue alignment checks passed');
