import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { DeploymentExecutor } from '../dist/domains/deployments/DeploymentExecutor.js';
import { DeploymentJobStore } from '../dist/domains/deployments/DeploymentJobStore.js';
import { DeploymentRequestStore } from '../dist/domains/deployments/DeploymentRequestStore.js';

async function withTempWorkspace(fn) {
  const root = await mkdtemp(join(tmpdir(), 'cat-cafe-deployment-executor-'));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe('DeploymentExecutor', () => {
  it('generates a static preview, source package, logs, and container plan', async () => {
    await withTempWorkspace(async (root) => {
      const workspace = join(root, 'site');
      await mkdir(workspace, { recursive: true });
      await writeFile(join(workspace, 'index.html'), '<!doctype html><title>Preview OK</title>', 'utf-8');
      await writeFile(join(workspace, 'Dockerfile'), 'FROM nginx:alpine\n', 'utf-8');

      const requestStore = new DeploymentRequestStore();
      const request = await requestStore.create({
        userId: 'user-1',
        channelId: 'channel-1',
        channelType: 1,
        originalText: '部署',
        target: workspace,
        environment: 'preview',
        workspacePath: workspace,
      });
      const jobStore = new DeploymentJobStore();
      const job = await jobStore.createQueued({
        deploymentRequestId: request.id,
        userId: request.userId,
        channelId: request.channelId,
        channelType: request.channelType,
        target: request.target,
        environment: request.environment,
        workspacePath: workspace,
      });
      const executor = new DeploymentExecutor({
        jobStore,
        deploymentsDir: join(root, 'deployments'),
        allowedRoots: [root],
        defaultRoot: root,
        publicBaseUrl: 'http://api.test',
      });

      const result = await executor.execute(job, request);

      assert.equal(result.status, 'succeeded');
      assert.match(result.previewUrl, /\/api\/deployments\/deploy_.+\/preview\//);
      assert.match(result.downloadUrl, /\/api\/deployments\/deploy_.+\/download/);
      assert.equal(result.containerPlan.executed, false);
      assert.match(result.containerPlan.dockerfilePath, /site\/Dockerfile$/);
      assert.ok(result.logs.some((entry) => entry.message.includes('Static preview generated')));
    });
  });

  it('fails targets outside allowed workspace roots', async () => {
    await withTempWorkspace(async (root) => {
      const outside = await mkdtemp(join(tmpdir(), 'cat-cafe-outside-deployment-'));
      try {
        await writeFile(join(outside, 'index.html'), '<!doctype html><title>Outside</title>', 'utf-8');
        const requestStore = new DeploymentRequestStore();
        const request = await requestStore.create({
          userId: 'user-1',
          channelId: 'channel-1',
          channelType: 1,
          originalText: '部署',
          target: outside,
          environment: 'preview',
        });
        const jobStore = new DeploymentJobStore();
        const job = await jobStore.createQueued({
          deploymentRequestId: request.id,
          userId: request.userId,
          channelId: request.channelId,
          channelType: request.channelType,
          target: request.target,
          environment: request.environment,
        });
        const executor = new DeploymentExecutor({
          jobStore,
          deploymentsDir: join(root, 'deployments'),
          allowedRoots: [root],
          defaultRoot: root,
        });

        const result = await executor.execute(job, request);

        assert.equal(result.status, 'failed');
        assert.match(result.failureReason, /allowed workspace root/);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });
  });
});
