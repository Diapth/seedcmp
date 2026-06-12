import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

describe('OutboundDeliveryHook artifact auto-registration (V3-31)', () => {
  it('auto-registers a delivered file as a thread artifact', async () => {
    const userWorkspace = await createTempDir('reg-user-');
    const uploadDir = await createTempDir('reg-uploads-');
    const srcDir = await createTempDir('reg-src-');
    const file = join(srcDir, 'index.html');
    await writeFile(file, '<html>restaurant</html>');

    setEnv('MAOMI_WORKSPACE_ROOT', userWorkspace);
    setEnv('UPLOAD_DIR', uploadDir);

    const { OutboundDeliveryHook } = await import(
      '../dist/infrastructure/connectors/OutboundDeliveryHook.js'
    );

    const registered = [];
    const adapter = { connectorId: 'im-web', async sendReply() {}, async sendMedia() {} };
    const bindingStore = {
      async getByThread() {
        return [{ connectorId: 'im-web', externalChatId: 'chat-1', userId: 'user-1' }];
      },
    };
    const noopLog = { info() {}, warn() {}, error() {}, debug() {}, fatal() {}, trace() {} };

    const hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['im-web', adapter]]),
      log: noopLog,
      artifactRegistrar: async (record) => {
        registered.push(record);
      },
    });

    await hook.deliver('thread-1', `最终可打开路径还是这个: ${file}`, 'xtz');

    assert.equal(registered.length, 1);
    const rec = registered[0];
    assert.equal(rec.threadId, 'thread-1');
    assert.equal(rec.userId, 'user-1');
    assert.equal(rec.ownerCatId, 'xtz');
    assert.equal(rec.fileName, 'index.html');
    assert.equal(rec.kind, 'code');
    // A source/web file named in text registers at its real path (existence-checked).
    assert.equal(rec.absolutePath, file);
  });

  it('does nothing when no artifactRegistrar is configured', async () => {
    const uploadDir = await createTempDir('reg-uploads-');
    const srcDir = await createTempDir('reg-src-');
    const file = join(srcDir, 'notes.txt');
    await writeFile(file, 'hi');
    setEnv('UPLOAD_DIR', uploadDir);
    setEnv('CLOWDER_PROMOTE_DELIVERABLES', '0');

    const { OutboundDeliveryHook } = await import(
      '../dist/infrastructure/connectors/OutboundDeliveryHook.js'
    );
    const adapter = { connectorId: 'im-web', async sendReply() {}, async sendMedia() {} };
    const bindingStore = {
      async getByThread() {
        return [{ connectorId: 'im-web', externalChatId: 'chat-1', userId: 'user-1' }];
      },
    };
    const noopLog = { info() {}, warn() {}, error() {}, debug() {}, fatal() {}, trace() {} };

    const hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['im-web', adapter]]),
      log: noopLog,
    });

    // Should not throw without a registrar.
    await hook.deliver('thread-1', `附件: ${file}`, 'xtz');
  });
});
