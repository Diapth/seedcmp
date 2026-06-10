import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const requiredFiles = [
  'package.json',
  'vite.config.js',
  'components/chat/ConversationList.vue',
  'components/chat/ConversationItem.vue',
  'components/chat/MessageInput.vue',
  'stores/conversation.js',
  'stores/message.js',
  'stores/group.js',
  'services/native-im/service.js'
];

for (const file of requiredFiles) {
  assert.equal(existsSync(file), true, `${file} should exist`);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(typeof packageJson.scripts['dev:h5'], 'string', 'dev:h5 script should exist');
assert.equal(typeof packageJson.scripts['build:h5'], 'string', 'build:h5 script should exist');
assert.equal(typeof packageJson.scripts['test:native-im'], 'string', 'test:native-im script should exist');

const messageInput = readFileSync('components/chat/MessageInput.vue', 'utf8');
assert.match(messageInput, /chooseAlbumImage/, 'image picker should be wired');
assert.match(messageInput, /chooseFile/, 'file picker should be wired');

const conversationItem = readFileSync('components/chat/ConversationItem.vue', 'utf8');
assert.match(conversationItem, /text-overflow:\s*ellipsis/, 'conversation preview should ellipsize');

const nativeService = readFileSync('services/native-im/service.js', 'utf8');
assert.match(nativeService, /updateConversationExtra/, 'draft sync API should exist');
assert.match(nativeService, /uploadChatFile/, 'upload API should exist');
assert.match(nativeService, /createGroup/, 'group creation API should exist');

const registerPage = readFileSync('pages/login/register.vue', 'utf8');
assert.match(registerPage, /不少于8位/, 'register password hint should match backend 8-character minimum');
assert.doesNotMatch(registerPage, /不少于6位|length < 6/, 'register page should not allow 6-character passwords before backend validation');

const deploymentCard = readFileSync('components/chat/DeploymentCard.vue', 'utf8');
assert.doesNotMatch(deploymentCard, /v-if="isSucceeded"[\s\S]{0,160}>取消部署<\/button>/, 'terminal deployment cards should not render cancel actions');

console.log('sections/ui smoke test passed');
