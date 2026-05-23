import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const groupStore = read('packages/datasource-vue/src/stores/groupStore.ts');
const groupChatUtils = read('packages/datasource-vue/src/stores/groupChatUtils.ts');
const conversationStore = read('packages/datasource-vue/src/stores/conversationStore.ts');
const messageStore = read('packages/datasource-vue/src/stores/messageStore.ts');
const cmdListeners = read('packages/datasource-vue/src/cmd/index.ts');
const createGroupPage = read('apps/chat/src/views/CreateGroupPage.vue');
const mainLayout = read('apps/chat/src/layouts/MainLayout.vue');
const backendGroupDB = fs.readFileSync(
  path.resolve(repoRoot, '../im/TangSengDaoDaoServer/modules/group/db.go'),
  'utf8'
);
const backendConversationAPI = fs.readFileSync(
  path.resolve(repoRoot, '../im/TangSengDaoDaoServer/modules/message/api_conversation.go'),
  'utf8'
);

assert.match(
  groupStore,
  /function\s+upsertGroup\s*\(/,
  'groupStore should expose a local upsertGroup helper so synced conversation groups can populate contacts'
);

assert.match(
  groupChatUtils,
  /save:\s*Number\([^)]*\)\s*\|\|\s*1/,
  'normalized joined groups should default to save=1 so contacts show newly joined groups'
);

assert.match(
  conversationStore,
  /useGroupStore/,
  'conversation sync should import/use groupStore'
);

assert.match(
  conversationStore,
  /groupStore\.upsertGroup\(g\)/,
  'conversation sync should mirror res.groups into groupStore for contact list retention'
);

assert.match(
  conversationStore,
  /clearedUnreadSeqs/,
  'conversation store should remember locally cleared unread sequence boundaries'
);

assert.match(
  conversationStore,
  /getEffectiveUnread/,
  'conversation sync should ignore stale unread counts at or below locally cleared sequences'
);

assert.match(
  conversationStore,
  /message\.isUnreadCleared[\s\S]*conv\.unread\s*=\s*0/,
  'conversation updates for active-channel messages should clear unread even if they run after clearUnread'
);

assert.match(
  createGroupPage,
  /useGroupStore/,
  'CreateGroupPage should update groupStore after creating a group'
);

assert.match(
  createGroupPage,
  /groupStore\.upsertGroup/,
  'CreateGroupPage should insert the newly created group into groupStore before navigation'
);

assert.match(
  mainLayout,
  /useGroupStore/,
  'MainLayout should load the group store on app startup so refreshed users can find existing groups without first mounting contacts'
);

assert.match(
  mainLayout,
  /groupStore\.fetchMyGroups\(\)/,
  'MainLayout startup should fetch joined groups because conversation sync may omit old group conversations'
);

assert.match(
  messageStore,
  /isUnreadCleared:\s*msg\.isUnreadCleared\s*===\s*true/,
  'realtime messages already viewed in the active chat should not increment unread when conversation updates later'
);

assert.match(
  cmdListeners,
  /isUnreadCleared:\s*!isOwnMessage\s*&&\s*isViewingChannel/,
  'message listener should mark active-channel realtime messages as unread-cleared before storing them'
);

assert.match(
  backendGroupDB,
  /From\("group_member"\).*group_member\.uid=\?/s,
  'backend group/my query should be based on active group membership, not only saved group settings'
);

assert.match(
  backendGroupDB,
  /LeftJoin\("group",\s*"`group`\.group_no=group_member\.group_no"\)/,
  'backend group/my query should pass unquoted table names to dbr.LeftJoin to avoid malformed `group`` SQL'
);

const clearUnreadBody = backendConversationAPI.match(/func \(co \*Conversation\) clearConversationUnread\(c \*wkhttp\.Context\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(
  clearUnreadBody.includes('co.ctx.IMClearConversationUnread'),
  'clear unread API should still call IM clear unread'
);
assert.ok(
  !/cmd", common\.CMDConversationUnreadClear\)[\s\S]{0,120}c\.ResponseError/.test(clearUnreadBody),
  'clear unread API should not fail the request only because unreadClear CMD notification failed'
);

console.log('group chat retention state checks passed');
