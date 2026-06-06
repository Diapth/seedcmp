import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('business mock cleanup', () => {
  it('does not emit canned media messages from MessageInput', () => {
    const source = read('components/chat/MessageInput.vue');

    expect(source).not.toContain('sendMockImage');
    expect(source).not.toContain('sendMockFile');
    expect(source).not.toContain('sendMockVoice');
    expect(source).not.toContain('images.unsplash.com/photo-1579202673506-ca3ce28943ef');
    expect(source).not.toContain('AgentHub_IM_Preview_Guide.docx');
    expect(source).toContain('showMediaUnavailable');
  });

  it('does not fabricate add-friend search results or file uploads', () => {
    const addFriend = read('pages/contacts/add.vue');
    const contactUtility = read('components/contacts/ContactUtilityPanel.vue');
    const contactList = read('components/contacts/ContactList.vue');
    const contactCard = read('components/contacts/ContactCard.vue');
    const files = read('pages/files/index.vue');

    expect(addFriend).not.toContain('Mock a new user');
    expect(addFriend).not.toContain('Math.random');
    expect(addFriend).toContain('contactStore.searchUser');
    expect(contactUtility).not.toContain('Math.random');
    expect(contactUtility).toContain('contactStore.searchUser');
    expect(contactList).not.toContain('Math.random');
    expect(contactList).not.toContain('分组创建成功');
    expect(contactCard).not.toContain('预设 mock');
    expect(contactCard).not.toContain('产品讨论群');
    expect(contactCard).not.toContain('13800000001');

    expect(files).not.toContain('mockFile');
    expect(files).not.toContain('Math.random');
    expect(files).toContain('markUnavailable');
  });

  it('wires typing indicators to the SDK-backed message store', () => {
    const input = read('components/chat/MessageInput.vue');
    const chatIndex = read('pages/chat/index.vue');
    const chatDetail = read('pages/chat/detail.vue');

    expect(input).toContain("'typing'");
    expect(input).toContain("emit('typing')");
    expect(chatIndex).toContain('@typing="handleTyping"');
    expect(chatIndex).toContain('messageStore.sendTyping');
    expect(chatDetail).toContain('@typing="handleTyping"');
    expect(chatDetail).toContain('messageStore.sendTyping');
  });

  it('does not fake QR or file download success', () => {
    const profile = read('pages/profile/index.vue');
    const groupQr = read('pages/group/qrcode.vue');
    const fileList = read('components/files/FileList.vue');
    const filePreview = read('components/chat/FilePreviewPanel.vue');

    expect(profile).not.toContain('演示用二维码');
    expect(profile).not.toContain('二维码已刷新');
    expect(groupQr).not.toContain('演示用二维码');
    expect(groupQr).not.toContain('二维码已重新生成');
    expect(groupQr).not.toContain('agenthub://group');

    expect(fileList).not.toContain('setInterval');
    expect(fileList).not.toContain('下载成功');
    expect(fileList).not.toContain('文件已打开');
    expect(fileList).toContain('showDownloadUnavailable');
    expect(filePreview).not.toContain('setInterval');
    expect(filePreview).not.toContain('下载已完成');
    expect(filePreview).toContain('showDownloadUnavailable');
  });

  it('does not present skill upload as a UI-only success path', () => {
    const skills = read('pages/agents/skills.vue');

    expect(skills).not.toContain('UI 占位');
    expect(skills).not.toContain('UI only');
    expect(skills).not.toContain('为界面示意');
    expect(skills).toContain('useSettingsStore');
    expect(skills).toContain('showSkillUploadUnavailable');
  });

  it('keeps the agents index skill preview bounded so the agent directory remains visible', () => {
    const index = read('pages/agents/index.vue');

    expect(index).toContain('previewSkills');
    expect(index).toContain('userSkills.value.slice(0, 10)');
    expect(index).toContain('v-for="skill in previewSkills"');
  });

  it('renders deployment payloads with the real deployment card component', () => {
    const bubble = read('components/chat/MessageBubble.vue');
    const chatIndex = read('pages/chat/index.vue');
    const chatDetail = read('pages/chat/detail.vue');

    expect(bubble).toContain('DeploymentCard');
    expect(bubble).toContain("data.type === 'deployment'");
    expect(chatIndex).toContain('hydrateActiveDeploymentCard');
    expect(chatIndex).toContain('deploymentStore.fetchActive');
    expect(chatIndex).toContain('messageStore.addDeploymentRequestCard');
    expect(chatDetail).toContain('hydrateActiveDeploymentCard');
    expect(chatDetail).toContain('deploymentStore.fetchActive');
    expect(chatDetail).toContain('messageStore.addDeploymentRequestCard');
  });

  it('wires project groups to real Clowder kanban and artifacts panels', () => {
    const workspace = read('components/chat/RightWorkspace.vue');
    const groupInfo = read('components/chat/GroupInfoPanel.vue');
    const artifacts = read('components/chat/ProjectArtifactsPanel.vue');

    expect(workspace).toContain('ProjectKanbanPanel');
    expect(workspace).toContain('ProjectArtifactsPanel');
    expect(workspace).toContain('clowderStore.fetchBinding');
    expect(workspace).toContain('clowderStore.fetchActiveProjectGroup');
    expect(workspace).not.toContain('useAgentStore');
    expect(workspace).not.toContain('agentStore.boards');

    expect(groupInfo).toContain('projectThreadId');
    expect(groupInfo).toContain('open-project-workspace');
    expect(groupInfo).not.toContain('useAgentStore');
    expect(groupInfo).not.toContain('agentStore.boards');

    expect(artifacts).toContain('threadId');
    expect(artifacts).toContain('fetchThreadArtifacts');
    expect(artifacts).not.toContain('fetchArtifacts(props.coordinationId)');
  });

  it('defaults OAuth cat creation to backend-required provider account refs', () => {
    const newAgent = read('pages/agents/new.vue');

    expect(newAgent).toContain('defaultAccountRef');
    expect(newAgent).toContain("accountRef: defaultAccountRef('claude-code')");
    expect(newAgent).toContain("form.value.accountRef = defaultAccountRef(form.value.platform)");
  });
});
