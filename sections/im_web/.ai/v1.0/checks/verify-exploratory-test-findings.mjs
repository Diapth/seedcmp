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

const registerPage = read('packages/login-vue/src/views/RegisterPage.vue');
const myProfileDrawer = read('apps/chat/src/views/MyProfileDrawer.vue');
const friendRequestsPage = read('packages/contacts-vue/src/views/FriendRequestsPage.vue');
const deviceManagementPage = read('apps/chat/src/views/DeviceManagementPage.vue');
const mainLayout = read('apps/chat/src/layouts/MainLayout.vue');
const contactList = read('packages/contacts-vue/src/views/ContactList.vue');

assertContains(
  'RegisterPage keeps phone row inside card',
  registerPage,
  /\.phone-item\s*\{[\s\S]*min-width: 0;/
);

assertContains(
  'RegisterPage inputs use border-box sizing',
  registerPage,
  /\.form-input\s*\{[\s\S]*box-sizing: border-box;/
);

assertContains(
  'MyProfileDrawer treats known backend CMD failures as profile success',
  myProfileDrawer,
  /isNonBlockingCmdFailure\(err\)[\s\S]*个人资料已保存/
);

assertContains(
  'FriendRequestsPage treats known backend CMD failures as accepted',
  friendRequestsPage,
  /isNonBlockingCmdFailure\(err\)[\s\S]*markFriendRequestAccepted/
);

assertContains(
  'DeviceManagementPage detects web browser devices',
  deviceManagementPage,
  /function getDeviceKind\(device: any\)[\s\S]*return 'Web'/
);

assertContains(
  'ContactList exposes group chat entry',
  contactList,
  /groupStore\.fetchMyGroups\(\)[\s\S]*群聊[\s\S]*handleGroupClick\(group\.group_no\)/
);

assertNotContains(
  'MainLayout does not expose deprecated create group entry',
  mainLayout,
  /goToCreateGroup|发起群聊|\/chat\/create-group/
);

assertContains(
  'MyProfileDrawer exposes blacklist entry',
  myProfileDrawer,
  /goToBlacklist[\s\S]*\/chat\/blacklist/
);

console.log('exploratory test findings checks passed');
