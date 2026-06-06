import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import Fastify from 'fastify';
import { DeploymentExecutor } from '../../dist/domains/deployments/DeploymentExecutor.js';
import { DeploymentJobStore } from '../../dist/domains/deployments/DeploymentJobStore.js';
import { DeploymentRequestStore } from '../../dist/domains/deployments/DeploymentRequestStore.js';
import { connectorDeploymentActionRoutes } from '../../dist/routes/connector-deployment-action.js';
import { connectorDeploymentRequestRoutes } from '../../dist/routes/connector-deployment-requests.js';
import { deploymentRoutes } from '../../dist/routes/deployments.js';

const HEADERS = {
  'content-type': 'application/json',
  'x-cat-cafe-user': 'test-user',
};

function buildApp({ deploymentsDir, allowedRoots, publicBaseUrl }) {
  const deploymentRequestStore = new DeploymentRequestStore();
  const deploymentJobStore = new DeploymentJobStore();
  const deploymentExecutor = new DeploymentExecutor({
    jobStore: deploymentJobStore,
    deploymentsDir,
    allowedRoots,
    defaultRoot: allowedRoots[0],
    publicBaseUrl,
  });
  const app = Fastify();
  app.register(connectorDeploymentRequestRoutes, { deploymentRequestStore });
  app.register(deploymentRoutes, { deploymentJobStore });
  app.register(connectorDeploymentActionRoutes, { deploymentRequestStore, deploymentJobStore, deploymentExecutor });
  return { app, deploymentRequestStore, deploymentJobStore };
}

async function waitForDeploymentRequest(app, requestId, predicate, attempts = 30) {
  let last;
  for (let index = 0; index < attempts; index += 1) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/connectors/im-web/deployment-requests/${encodeURIComponent(requestId)}`,
      headers: HEADERS,
    });
    assert.equal(response.statusCode, 200);
    last = JSON.parse(response.payload).deploymentRequest;
    if (predicate(last)) return last;
    await delay(50);
  }
  assert.fail(`deployment request did not reach expected state; last=${JSON.stringify(last)}`);
}

describe('deployment request routes', () => {
  let app;
  let tempRoot;
  let workspaceDir;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'cat-cafe-deployment-routes-'));
    workspaceDir = join(tempRoot, 'workspace');
    await mkdir(workspaceDir, { recursive: true });
    await writeFile(join(workspaceDir, 'index.html'), '<!doctype html><title>部署阶段4验收</title>', 'utf-8');
    ({ app } = buildApp({
      deploymentsDir: join(tempRoot, 'deployments'),
      allowedRoots: [tempRoot],
      publicBaseUrl: 'http://api.test',
    }));
  });

  afterEach(async () => {
    await app.close();
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('creates, patches, and hydrates the latest deployment request', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/connectors/im-web/deployment-requests',
      headers: HEADERS,
      payload: {
        channelId: 'channel-a',
        channelType: 1,
        originalText: '帮我部署',
        targetCandidates: [
          { id: 'workspace', label: '婚礼', value: '婚礼', source: 'active_workspace' },
        ],
        environmentCandidates: [
          { id: 'local', label: '本地', value: 'local' },
        ],
      },
    });
    assert.equal(createRes.statusCode, 201);
    const created = JSON.parse(createRes.payload).deploymentRequest;
    assert.equal(created.status, 'needs_fields');
    assert.deepEqual(created.missingFields.sort(), ['environment', 'target']);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/connectors/im-web/deployment-requests/${encodeURIComponent(created.id)}`,
      headers: HEADERS,
      payload: {
        target: '婚礼',
        environment: 'local',
        sourceMessageId: 'msg-1',
        cardMessageId: 'deployment-card-1',
      },
    });
    assert.equal(patchRes.statusCode, 200);
    const patched = JSON.parse(patchRes.payload).deploymentRequest;
    assert.equal(patched.status, 'pending_confirmation');
    assert.deepEqual(patched.missingFields, []);

    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/api/connectors/im-web/deployment-requests',
      headers: HEADERS,
      payload: {
        channelId: 'channel-a',
        channelType: 1,
        originalText: '再发一次部署',
      },
    });
    assert.equal(duplicateRes.statusCode, 200);
    const duplicate = JSON.parse(duplicateRes.payload);
    assert.equal(duplicate.activeRequestExists, true);
    assert.equal(duplicate.deploymentRequest.id, created.id);

    const activeRes = await app.inject({
      method: 'GET',
      url: '/api/connectors/im-web/deployment-requests/active?channelId=channel-a&channelType=1',
      headers: HEADERS,
    });
    assert.equal(activeRes.statusCode, 200);
    const active = JSON.parse(activeRes.payload).deploymentRequest;
    assert.equal(active.id, created.id);
    assert.equal(active.status, 'pending_confirmation');

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/connectors/im-web/deployment-requests/${encodeURIComponent(created.id)}`,
      headers: HEADERS,
    });
    assert.equal(detailRes.statusCode, 200);
    assert.equal(JSON.parse(detailRes.payload).deploymentRequest.id, created.id);
  });

  it('persists confirm and cancel actions through the request store', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/connectors/im-web/deployment-requests',
      headers: HEADERS,
      payload: {
        channelId: 'channel-b',
        channelType: 1,
        originalText: '帮我部署婚礼',
        target: workspaceDir,
        environment: 'local',
        workspacePath: workspaceDir,
      },
    });
    const requestId = JSON.parse(createRes.payload).deploymentRequest.id;

    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/connectors/im-web/deployment-action',
      headers: HEADERS,
      payload: {
        channelId: 'channel-b',
        channelType: 1,
        deploymentRequestId: requestId,
        action: 'confirm',
        actionId: 'confirm-1',
        cardMessageId: 'deployment-card-2',
        sourceMessageId: 'msg-2',
        target: workspaceDir,
        environment: 'local',
        workspacePath: workspaceDir,
        missingFields: [],
      },
    });
    assert.equal(confirmRes.statusCode, 200);
    const confirmed = JSON.parse(confirmRes.payload);
    assert.equal(confirmed.status, 'queued');
    assert.equal(confirmed.deployment.status, 'queued');
    assert.equal(confirmed.deploymentRequest.status, 'queued');

    const completed = await waitForDeploymentRequest(app, requestId, (request) => request.status === 'succeeded');
    assert.match(completed.previewUrl, /^http:\/\/api\.test\/api\/deployments\/deploy_/);
    assert.match(completed.downloadUrl, /^http:\/\/api\.test\/api\/deployments\/deploy_/);

    const previewRes = await app.inject({
      method: 'GET',
      url: `/api/deployments/${encodeURIComponent(requestId)}/preview/`,
      headers: HEADERS,
    });
    assert.equal(previewRes.statusCode, 200);
    assert.match(previewRes.payload, /部署阶段4验收/);

    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/deployments/${encodeURIComponent(requestId)}/download`,
      headers: HEADERS,
    });
    assert.equal(downloadRes.statusCode, 200);
    assert.equal(downloadRes.headers['content-type'], 'application/gzip');

    const logsRes = await app.inject({
      method: 'GET',
      url: `/api/deployments/${encodeURIComponent(requestId)}/logs`,
      headers: HEADERS,
    });
    assert.equal(logsRes.statusCode, 200);
    assert.match(logsRes.payload, /Deployment executor started/);

    const latestAfterConfirm = await app.inject({
      method: 'GET',
      url: '/api/connectors/im-web/deployment-requests/active?channelId=channel-b&channelType=1',
      headers: HEADERS,
    });
    assert.equal(latestAfterConfirm.statusCode, 200);
    assert.equal(JSON.parse(latestAfterConfirm.payload).deploymentRequest.status, 'succeeded');

    const cancelCreateRes = await app.inject({
      method: 'POST',
      url: '/api/connectors/im-web/deployment-requests',
      headers: HEADERS,
      payload: {
        channelId: 'channel-b',
        channelType: 1,
        originalText: '帮我取消另一项部署',
        target: '另一个项目',
        environment: 'local',
      },
    });
    const cancelRequestId = JSON.parse(cancelCreateRes.payload).deploymentRequest.id;

    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/connectors/im-web/deployment-action',
      headers: HEADERS,
      payload: {
        channelId: 'channel-b',
        channelType: 1,
        deploymentRequestId: cancelRequestId,
        action: 'cancel',
        actionId: 'cancel-1',
        cardMessageId: 'deployment-card-3',
        sourceMessageId: 'msg-3',
        target: '另一个项目',
        environment: 'local',
        missingFields: [],
      },
    });
    assert.equal(cancelRes.statusCode, 200);
    const cancelled = JSON.parse(cancelRes.payload);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.deploymentRequest.status, 'cancelled');

    const latestAfterCancel = await app.inject({
      method: 'GET',
      url: '/api/connectors/im-web/deployment-requests/active?channelId=channel-b&channelType=1',
      headers: HEADERS,
    });
    assert.equal(latestAfterCancel.statusCode, 200);
    assert.equal(JSON.parse(latestAfterCancel.payload).deploymentRequest.status, 'cancelled');
  });
});
