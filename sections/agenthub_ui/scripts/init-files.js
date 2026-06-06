import fs from 'fs';
import path from 'path';

const dirs = [
  'pages/login',
  'pages/chat',
  'pages/group',
  'pages/contacts',
  'pages/agents',
  'pages/files',
  'pages/settings',
  'components/common',
  'components/layout',
  'components/chat',
  'components/contacts',
  'components/agents',
  'components/files',
  'components/settings',
  'stores',
  'composables',
  'utils'
];

const vuePages = [
  'pages/login/index.vue',
  'pages/login/register.vue',
  'pages/chat/index.vue',
  'pages/chat/detail.vue',
  'pages/group/index.vue',
  'pages/group/create.vue',
  'pages/group/members.vue',
  'pages/contacts/index.vue',
  'pages/contacts/friend-requests.vue',
  'pages/contacts/add.vue',
  'pages/contacts/blacklist.vue',
  'pages/agents/index.vue',
  'pages/agents/new.vue',
  'pages/files/index.vue',
  'pages/settings/index.vue',
  'pages/settings/devices.vue'
];

const vueComponents = [
  'components/common/AppIcon.vue',
  'components/common/AppAvatar.vue',
  'components/common/AppEmptyState.vue',
  'components/common/AppStatusBadge.vue',
  'components/common/AppDialog.vue',
  'components/layout/AppShell.vue',
  'components/layout/DesktopSidebar.vue',
  'components/layout/MobileTabBar.vue',
  'components/chat/ConversationList.vue',
  'components/chat/ConversationItem.vue',
  'components/chat/MessageList.vue',
  'components/chat/MessageBubble.vue',
  'components/chat/MessageInput.vue',
  'components/chat/MessageContextMenu.vue',
  'components/chat/RightWorkspace.vue',
  'components/chat/FilePreviewPanel.vue',
  'components/chat/ClowderPanel.vue',
  'components/contacts/ContactList.vue',
  'components/contacts/ContactCard.vue',
  'components/agents/AgentCard.vue',
  'components/files/FileList.vue',
  'components/settings/SettingsSection.vue'
];

const stores = [
  'stores/app.js',
  'stores/navigation.js',
  'stores/conversation.js',
  'stores/message.js',
  'stores/contact.js',
  'stores/agent.js',
  'stores/file.js',
  'stores/settings.js'
];

const composables = [
  'composables/useResponsiveLayout.js',
  'composables/useSafeArea.js',
  'composables/useVisualState.js'
];

const utils = [
  'utils/formatConversation.js',
  'utils/formatMessage.js',
  'utils/avatarFallback.js',
  'utils/manifestCoverage.js'
];

// Ensure dirs
dirs.forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

// Write vue pages with simple template
vuePages.forEach(file => {
  const name = path.basename(file, '.vue');
  const content = `<template>
  <view class="placeholder-page">
    <text>${name} Page Placeholder</text>
  </view>
</template>

<script setup>
// Placeholder
</script>

<style scoped>
.placeholder-page {
  padding: 20px;
  text-align: center;
}
</style>
`;
  fs.writeFileSync(file, content, 'utf8');
});

// Write vue components
vueComponents.forEach(file => {
  const name = path.basename(file, '.vue');
  const content = `<template>
  <view class="placeholder-component">
    <text>${name} Component Placeholder</text>
  </view>
</template>

<script setup>
// Placeholder
</script>

<style scoped>
.placeholder-component {
  padding: 10px;
}
</style>
`;
  fs.writeFileSync(file, content, 'utf8');
});

// Write stores
stores.forEach(file => {
  const name = path.basename(file, '.js');
  const content = `import { defineStore } from 'pinia';

export const use${name.charAt(0).toUpperCase() + name.slice(1)}Store = defineStore('${name}', {
  state: () => ({
    // placeholder
  }),
  actions: {}
});
`;
  fs.writeFileSync(file, content, 'utf8');
});

// Write composables
composables.forEach(file => {
  const content = `import { ref } from 'vue';

export function ${path.basename(file, '.js')}() {
  // placeholder
  return {};
}
`;
  fs.writeFileSync(file, content, 'utf8');
});

// Write utils
utils.forEach(file => {
  const content = `// Placeholder for ${path.basename(file)}
export default {};
`;
  fs.writeFileSync(file, content, 'utf8');
});

console.log('All project files initialized successfully!');

