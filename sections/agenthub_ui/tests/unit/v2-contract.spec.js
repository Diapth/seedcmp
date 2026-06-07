import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const agenthubRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(agenthubRoot, '../..');

function readAgenthub(relativePath) {
  return fs.readFileSync(path.join(agenthubRoot, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('V2 acceptance contracts', () => {
  it('blocks weak registration passwords before network submission', () => {
    const source = readAgenthub('pages/login/register.vue');

    expect(source).toContain('confirmPassword');
    expect(source).toContain('确认密码');
    expect(source).toContain('至少 8 位');
    expect(source).toContain('password.value.length < 8');
    expect(source).toContain('/^(?=.*[A-Za-z])(?=.*\\d).{8,}$/');
    expect(source).toContain('两次输入的密码不一致');
    expect(source).toContain('authStore.register');
  });

  it('keeps TangSeng registration validation aligned to the 8-character rule', () => {
    const source = readRepo('sections/im/TangSengDaoDaoServer/modules/user/api.go');

    expect(source).toContain('len(r.Password) < 8');
    expect(source).toContain('密码长度必须不少于8位');
  });

  it('rotates TangSeng login tokens for Web/PC sessions so a second login kicks the old H5 session', () => {
    const source = readRepo('sections/im/TangSengDaoDaoServer/modules/user/api.go');

    expect(source).toContain('Delete(u.ctx.GetConfig().Cache.TokenCachePrefix + oldToken)');
    expect(source).not.toContain('token = oldToken');
    expect(source).not.toContain('PC暂时不执行删除操作');
  });

  it('rejects dangerous uploaded file extensions on the backend', () => {
    const source = readRepo('sections/im/TangSengDaoDaoServer/modules/file/api.go');

    expect(source).toContain('unsupportedUploadExtensions');
    expect(source).toContain('isUnsupportedUploadPath');
    expect(source).toContain('.exe');
    expect(source).toContain('.bat');
    expect(source).toContain('不支持的文件类型');
  });

  it('renders media previews from file URLs and rejects executable preview types visibly', () => {
    const source = readAgenthub('components/chat/FilePreviewPanel.vue');

    expect(source).not.toContain('<scroll-view scroll-y class="preview-scroll flex-1">');
    expect(source).toContain('<view class="preview-scroll flex-1">');
    expect(source).toContain("previewKind === 'video'");
    expect(source).toContain("previewKind === 'audio'");
    expect(source).toContain('mediaPreviewUrl');
    expect(source).toContain('function escapeHtmlAttr');
    expect(source).toContain('const safeSrc = escapeHtmlAttr(src)');
    expect(source).toContain('危险文件已阻止');
    expect(source).toContain('isBlockedExecutable');
  });

  it('renders a visible global kickout overlay when the backend invalidates the session', () => {
    const shell = readAgenthub('components/layout/AppShell.vue');
    const appStore = readAgenthub('stores/app.js');
    const wkSdk = readAgenthub('utils/wk-sdk.js');

    expect(shell).toContain('appStore.kickout.visible');
    expect(shell).toContain('账号已在其他设备登录');
    expect(shell).toContain('handleKickoutConfirm');
    expect(shell).toContain('/pages/login/index');
    expect(appStore).toContain('triggerKickout');
    expect(appStore).toContain('acknowledgeKickout');
    expect(wkSdk).toContain('registerConnectStatusListener');
    expect(wkSdk).toContain('ConnectKick');
    expect(wkSdk).toContain('reasonCode === 2');
  });

  it('keeps Agent API Key creation gated by a visible invalid-key state', () => {
    const source = readAgenthub('pages/agents/new.vue');

    expect(source).toContain('apiKeyValidationError');
    expect(source).toContain('isValidApiKey');
    expect(source).toContain('API Key 格式无效');
    expect(source).toContain('field-error');
  });

  it('surfaces Clowder capabilities and backend model options on the agent create page', () => {
    const source = readAgenthub('pages/agents/new.vue');

    expect(source).toContain('useClowderStore');
    expect(source).toContain('clowderStore.fetchCapabilities');
    expect(source).toContain('capabilityStatusText');
    expect(source).toContain('Clowder capabilities');
    expect(source).toContain('modelOptions');
    expect(source).not.toContain("const fallbackModels = ['自定义']");
  });

  it('shows the project board as four Clowder-backed task states', () => {
    const source = readAgenthub('pages/agents/board.vue');

    expect(source).toContain('useClowderStore');
    expect(source).toContain('kanbanColumns');
    expect(source).toContain('todo');
    expect(source).toContain('doing');
    expect(source).toContain('blocked');
    expect(source).toContain('done');
    expect(source).toContain('fetchThreadTasks');
  });

  it('keeps the Clowder kanban board responsive on mobile without clipped columns', () => {
    const board = readAgenthub('pages/agents/board.vue');
    const icon = readAgenthub('components/common/AppIcon.vue');

    expect(board).toContain('class="header-action kanban-refresh');
    expect(board).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(board).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(board).toContain('.kanban-panel-head');
    expect(icon).toContain('refresh:');
  });

  it('refreshes file preview data when the same H5 page receives a new route file parameter', () => {
    const source = readAgenthub('pages/files/preview.vue');

    expect(source).toContain('onLoad');
    expect(source).toContain('onShow');
    expect(source).toContain('hashchange');
    expect(source).toContain('syncFileParam');
    expect(source).toContain('readFileParamFromHash');
  });

  it('keeps the V2 full runner worktree-local and resets auth after kickout-sensitive cases', () => {
    const source = readAgenthub('.ai/tests/v2-full-runner.mjs');

    expect(source).toContain('fileURLToPath(import.meta.url)');
    expect(source).not.toContain("'/home/yunyi/Desktop/Bytedance_cmp/seedcmp'");
    expect(source).toContain('ensureAuthenticated');
    expect(source).toContain('requiresAuthenticatedRoute');
  });
});
