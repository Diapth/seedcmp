import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import Fastify from 'fastify';
import { DeploymentRequestStore } from '../../dist/domains/deployments/DeploymentRequestStore.js';
import { connectorDeploymentActionRoutes } from '../../dist/routes/connector-deployment-action.js';
import { connectorDeploymentRequestRoutes } from '../../dist/routes/connector-deployment-requests.js';

const HEADERS = {
  'content-type': 'application/json',
  'x-cat-cafe-user': 'test-user',
};

function buildApp() {
  const deploymentRequestStore = new DeploymentRequestStore();
  const app = Fastify();
  app.register(connectorDeploymentRequestRoutes, { deploymentRequestStore });
  app.register(connectorDeploymentActionRoutes, { deploymentRequestStore });
  return { app, deploymentRequestStore };
}

describe('deployment request routes', () => {
  let app;

  beforeEach(() => {
    ({ app } = buildApp());
  });

  afterEach(async () => {
    await app.close();
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
        target: '婚礼',
        environment: 'local',
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
        target: '婚礼',
        environment: 'local',
        missingFields: [],
      },
    });
    assert.equal(confirmRes.statusCode, 200);
    const confirmed = JSON.parse(confirmRes.payload);
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(confirmed.deploymentRequest.status, 'confirmed');

    const latestAfterConfirm = await app.inject({
      method: 'GET',
      url: '/api/connectors/im-web/deployment-requests/active?channelId=channel-b&channelType=1',
      headers: HEADERS,
    });
    assert.equal(latestAfterConfirm.statusCode, 200);
    assert.equal(JSON.parse(latestAfterConfirm.payload).deploymentRequest.status, 'confirmed');

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
