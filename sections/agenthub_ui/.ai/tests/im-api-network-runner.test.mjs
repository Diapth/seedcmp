import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProbePlan,
  documentCoversCall,
  extractDocumentedEndpoints,
  extractTangSengWebCallsFromText,
  normalizeEndpointPath
} from './im-api-network-runner.mjs';

test('extracts documented endpoints from markdown tables', () => {
  const endpoints = extractDocumentedEndpoints(`
| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | \`/v1/common/appconfig\` | 否 | 配置 |
| POST | \`/v1/conversation/sync\` | 是 | 最近会话 |
`);

  assert.deepEqual(
    endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
    ['GET /v1/common/appconfig', 'POST /v1/conversation/sync']
  );
});

test('normalizes queries and matches dynamic documented paths', () => {
  const docs = extractDocumentedEndpoints(`
| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | \`/v1/user/reddot/:category\` | 是 | 红点 |
| GET | \`/v1/sticker/user/sticker\` | 是 | 贴纸 |
`);

  assert.equal(normalizeEndpointPath('/v1/sticker/user/sticker?category=:param'), '/v1/sticker/user/sticker');
  assert.equal(documentCoversCall(docs, { method: 'GET', path: '/v1/user/reddot/friendApply' }), true);
  assert.equal(documentCoversCall(docs, { method: 'GET', path: '/v1/sticker/user/sticker?category=:param' }), true);
  assert.equal(documentCoversCall(docs, { method: 'POST', path: '/v1/user/reddot/friendApply' }), false);
});

test('extracts TangSengDaoDaoWeb API calls from source text', () => {
  const calls = extractTangSengWebCallsFromText(
    `
    WKApp.apiClient.get('common/appconfig');
    WKApp.apiClient.post(\`groups/\${channel.channelID}/members\`, { members });
    axios.delete("message", { data: [] });
    `,
    'sample.ts'
  );

  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.path}`),
    ['GET /v1/common/appconfig', 'POST /v1/groups/:param/members', 'DELETE /v1/message']
  );
});

test('default probe plan is non-destructive and includes documented frontend dependencies', () => {
  const probes = buildProbePlan({
    apiBaseUrl: 'http://172.18.58.156:3000/v1',
    username: '13733632709',
    password: '123456',
    deviceId: 'unit-test-device'
  });

  assert.equal(probes.some((probe) => probe.name === 'login'), true);
  assert.equal(probes.some((probe) => probe.path === '/v1/favorite/my?page_index=1&page_size=1'), true);
  assert.deepEqual(
    probes.find((probe) => probe.name === 'global-search')?.expectedStatuses,
    [200, 400]
  );
  assert.equal(probes.every((probe) => probe.safe === true), true);
  assert.equal(probes.some((probe) => probe.method === 'DELETE'), false);
});
