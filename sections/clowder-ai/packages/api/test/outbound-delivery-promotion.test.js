import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, it } from 'node:test';

const tmpRoots = [];
const savedEnv = {};

function setEnv(name, value) {
  if (!(name in savedEnv)) savedEnv[name] = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function createTempDir(prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tmpRoots.push(dir);
  return realpath(dir);
}

afterEach(async () => {
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  for (const key of Object.keys(savedEnv)) delete savedEnv[key];
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('OutboundDeliveryHook deliverable promotion (V3-39 §2.3)', () => {
  it('promotes a leaked /tmp deliverable into maomi_workspace and publishes it to /uploads', async () => {
    const userWorkspace = await createTempDir('promote-user-');
    const uploadDir = await createTempDir('promote-uploads-');
    const leakDir = await createTempDir('promote-leak-'); // stands in for /tmp
    const leakedFile = join(leakDir, 'test-page.zip');
    await writeFile(leakedFile, 'PK fake-zip-bytes');

    setEnv('MAOMI_WORKSPACE_ROOT', userWorkspace);
    setEnv('UPLOAD_DIR', uploadDir);
    setEnv('CLOWDER_PROMOTE_DELIVERABLES', undefined); // default-on

    const { OutboundDeliveryHook } = await import(
      '../dist/infrastructure/connectors/OutboundDeliveryHook.js'
    );

    const mediaCalls = [];
    const adapter = {
      connectorId: 'im-web',
      async sendReply() {},
      async sendMedia(_chatId, payload) {
        mediaCalls.push(payload);
      },
    };
    const bindingStore = {
      async getByThread() {
        return [{ connectorId: 'im-web', externalChatId: 'chat-1' }];
      },
    };
    const noopLog = { info() {}, warn() {}, error() {}, debug() {}, fatal() {}, trace() {} };

    const hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['im-web', adapter]]),
      log: noopLog,
    });

    await hook.deliver('thread-1', `已生成下载包: ${leakedFile}`);

    // 1. Durable copy now exists under the user workspace inbox.
    const inboxEntries = await readdir(join(userWorkspace, '_inbox'));
    assert.deepEqual(inboxEntries, ['test-page.zip']);
    const promoted = await stat(join(userWorkspace, '_inbox', 'test-page.zip'));
    assert.ok(promoted.isFile());

    // 2. A web delivery was published from /uploads (browser-usable), distinct from the source.
    const fileDeliveries = mediaCalls.filter((c) => c.type === 'file');
    assert.equal(fileDeliveries.length, 1);
    assert.match(String(fileDeliveries[0].url), /\/uploads\/.+test-page.*\.zip/);

    // 3. The published delivery copy exists on disk in the upload dir.
    const uploadEntries = await readdir(uploadDir);
    assert.ok(uploadEntries.some((name) => name.endsWith('.zip')));
  });

  it('does not promote when CLOWDER_PROMOTE_DELIVERABLES=0', async () => {
    const userWorkspace = await createTempDir('promote-user-');
    const uploadDir = await createTempDir('promote-uploads-');
    const leakDir = await createTempDir('promote-leak-');
    const leakedFile = join(leakDir, 'note.txt');
    await writeFile(leakedFile, 'hello');

    setEnv('MAOMI_WORKSPACE_ROOT', userWorkspace);
    setEnv('UPLOAD_DIR', uploadDir);
    setEnv('CLOWDER_PROMOTE_DELIVERABLES', '0');

    const { OutboundDeliveryHook } = await import(
      '../dist/infrastructure/connectors/OutboundDeliveryHook.js'
    );

    const adapter = { connectorId: 'im-web', async sendReply() {}, async sendMedia() {} };
    const bindingStore = {
      async getByThread() {
        return [{ connectorId: 'im-web', externalChatId: 'chat-1' }];
      },
    };
    const noopLog = { info() {}, warn() {}, error() {}, debug() {}, fatal() {}, trace() {} };

    const hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['im-web', adapter]]),
      log: noopLog,
    });

    await hook.deliver('thread-1', `附件: ${leakedFile}`);

    // No inbox created when promotion is disabled.
    let promoted = true;
    try {
      await stat(join(userWorkspace, '_inbox'));
    } catch {
      promoted = false;
    }
    assert.equal(promoted, false);
  });

  it('publishes repo-relative clowder workspace file references as native IM files', async () => {
    const userWorkspace = await createTempDir('promote-user-');
    const uploadDir = await createTempDir('promote-uploads-');
    const repoRoot = await createTempDir('promote-repo-');
    await writeFile(join(repoRoot, '.git'), 'test git marker');
    const workspaceDir = join(repoRoot, '.clowder', 'workspaces', 'thread-riverwatch', 'riverwatch-docs');
    await mkdir(workspaceDir, { recursive: true });
    const workspaceFile = join(workspaceDir, 'prd.md');
    await writeFile(workspaceFile, '# RiverWatch PRD\n\nAI-created workspace artifact.');

    setEnv('MAOMI_WORKSPACE_ROOT', userWorkspace);
    setEnv('UPLOAD_DIR', uploadDir);
    setEnv('CLOWDER_PROMOTE_DELIVERABLES', '0');
    const previousCwd = process.cwd();
    process.chdir(repoRoot);
    try {
      const { OutboundDeliveryHook } = await import(
        '../dist/infrastructure/connectors/OutboundDeliveryHook.js'
      );

      const mediaCalls = [];
      const adapter = {
        connectorId: 'im-web',
        async sendReply() {},
        async sendMedia(_chatId, payload) {
          mediaCalls.push(payload);
        },
      };
      const bindingStore = {
        async getByThread() {
          return [{ connectorId: 'im-web', externalChatId: 'chat-1' }];
        },
      };
      const noopLog = { info() {}, warn() {}, error() {}, debug() {}, fatal() {}, trace() {} };

      const hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['im-web', adapter]]),
        log: noopLog,
      });

      await hook.deliver('thread-riverwatch', `文档路径：${relative(repoRoot, workspaceFile)}`);

      const fileDeliveries = mediaCalls.filter((call) => call.type === 'file');
      assert.equal(fileDeliveries.length, 1);
      assert.equal(fileDeliveries[0].fileName, 'prd.md');
      assert.match(String(fileDeliveries[0].url), /\/uploads\/.+prd.*\.md/);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
