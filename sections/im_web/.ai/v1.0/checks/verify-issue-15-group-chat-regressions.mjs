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

const groupChatUtils = read('packages/datasource-vue/src/stores/groupChatUtils.ts');
const conversationList = read('apps/chat/src/views/ConversationList.vue');
const conversationPresentation = read('apps/chat/src/utils/conversationPresentation.ts');
const groupSettingsDrawer = read('packages/base-vue/src/components/GroupSettingsDrawer.vue');
const messageStore = read('packages/datasource-vue/src/stores/messageStore.ts');
const conversationStore = read('packages/datasource-vue/src/stores/conversationStore.ts');

assertContains(
  'group placeholder conversations prefer historical last message time and preserve missing timestamps as zero',
  groupChatUtils,
  /const lastMessageTime[\s\S]*group\.last_msg_time[\s\S]*group\.created_at_time[\s\S]*\|\|\s*0[\s\S]*last_msg_time:\s*lastMessageTime/
);

assertNotContains(
  'group placeholder conversations do not use current time as fallback',
  groupChatUtils,
  /buildConversationFromGroup\([\s\S]*Date\.now/
);

assertContains(
  'conversation list detects system message digests',
  conversationList,
  /function isSystemDigest\([\s\S]*return \[99, 1000\]\.includes\(type\)/
);

assertContains(
  'conversation list does not prefix group system messages with sender names',
  conversationPresentation,
  /if \(Number\(options\.channelType\) !== 2 \|\| options\.isSystem\)[\s\S]*senderName:\s*''/
);

assertContains(
  'conversation list shows mention reminder for current user',
  conversationList,
  /function getMentionReminder\([\s\S]*'\[有人@我\]'/
);

assertContains(
  'conversation list uses Chinese-friendly conversation time formatter',
  conversationList,
  /formatConversationTime\(conv\.last_msg_time\)/
);

assertContains(
  'conversation presentation formats yesterday and weekday with time',
  conversationPresentation,
  /昨天 \$\{formatHourMinute\(date\)\}[\s\S]*星期三|星期日[\s\S]*formatHourMinute/
);

assertContains(
  'conversation presentation formats older dates as numeric month/day and year/month/day',
  conversationPresentation,
  /`\$\{pad2\(date\.getMonth\(\) \+ 1\)\}\/\$\{pad2\(date\.getDate\(\)\)\}`[\s\S]*date\.getFullYear\(\)/
);

assertContains(
  'conversation list renders mention before sender and message text inside digest',
  conversationList,
  /class="mention-prefix"[\s\S]*class="digest-sender"[\s\S]*class="digest-text"/
);

assertNotContains(
  'conversation list does not render mention reminder in right status area',
  conversationList,
  /item-status[\s\S]{0,400}mention-reminder/
);

assertContains(
  'conversation list renders distinct pin icon',
  conversationList,
  /class="status-icon pin-icon"/
);

assertContains(
  'conversation list renders distinct mute icon',
  conversationList,
  /class="status-icon mute-icon"/
);

assertNotContains(
  'conversation list no longer uses indistinguishable status dots',
  conversationList,
  /class="(?:pin|mute)-dot"/
);

assertNotContains(
  'group settings drawer does not use browser prompt',
  groupSettingsDrawer,
  /window\.prompt|prompt\(/
);

assertContains(
  'group settings drawer reloads data when opened',
  groupSettingsDrawer,
  /watch\([\s\S]*props\.visible[\s\S]*loadGroupDetails/
);

assertContains(
  'group settings drawer has custom invite modal state',
  groupSettingsDrawer,
  /showInviteModal[\s\S]*inviteKeyword[\s\S]*selectedInviteUsers[\s\S]*submitInviteMembers/
);

assertContains(
  'group settings invite modal stops clicks from closing while typing',
  groupSettingsDrawer,
  /class="invite-modal" @click\.stop/
);

assertContains(
  'group settings invite modal supports searching and selecting multiple users',
  groupSettingsDrawer,
  /searchInviteUser[\s\S]*addInviteUser[\s\S]*removeInviteUser/
);

assertContains(
  'group settings drawer exposes owner avatar editing affordance',
  groupSettingsDrawer,
  /class="avatar-edit-overlay"/
);

assertContains(
  'group settings drawer uses robust owner permission with current uid and member role fallback',
  groupSettingsDrawer,
  /currentMember[\s\S]*currentMemberRole[\s\S]*isCurrentUserOwner[\s\S]*currentMemberRole\.value === 1/
);

assertContains(
  'group settings drawer allows member role admin to manage group settings',
  groupSettingsDrawer,
  /canManageGroup[\s\S]*currentMemberRole\.value === 2/
);

assertContains(
  'group settings drawer uses different icons for pin and mute actions',
  groupSettingsDrawer,
  /class="action-icon pin-action-icon"[\s\S]*class="action-icon mute-action-icon"/
);

assertContains(
  'message store can fall back to latest system message when no normal history exists',
  messageStore,
  /getLatestConversationMessage\([\s\S]*getLatestConversationDigestMessage\(list\) \|\|/
);

assertContains(
  'conversation store prefetches group message summaries when conversation sync omits group conversations',
  conversationStore,
  /prefetchMissingGroupConversationSummaries[\s\S]*syncApi\.syncMessages[\s\S]*ensureConversationFromSyncedMessages/
);

assertContains(
  'conversation store only keeps group join placeholders when no history messages exist',
  conversationStore,
  /isGroupJoinPlaceholder[\s\S]*prefetchMissingGroupConversationSummaries[\s\S]*!conv \|\| isGroupJoinPlaceholder\(conv\)/
);

console.log('issue 15 group chat regression checks passed');
