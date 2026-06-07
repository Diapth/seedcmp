import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
const DEFAULT_DOCS_DIR = path.resolve('sections/agenthub_ui/.ai/docs');
const DEFAULT_OUT_ROOT = path.resolve('sections/agenthub_ui/.ai/tests-e2e');

export function normalizeEndpointPath(endpointPath) {
  let normalized = String(endpointPath || '').trim().replace(/`/g, '');
  const queryIndex = normalized.indexOf('?');
  if (queryIndex >= 0) normalized = normalized.slice(0, queryIndex);
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  return normalized.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function normalizeSourcePath(sourcePath) {
  let normalized = String(sourcePath || '').trim();
  normalized = normalized.replace(/\$\{[^}]+\}/g, ':param');
  normalized = normalized.replace(/\s+/g, '');
  normalized = normalized.replace(/^['"`]|['"`]$/g, '');
  if (/^https?:\/\//.test(normalized)) return normalized;
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/+/g, '/');
  if (!normalized.startsWith('/v1/') && !normalized.startsWith('/api/')) {
    normalized = `/v1${normalized}`;
  }
  return normalized;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function endpointPattern(endpointPath) {
  const segments = normalizeEndpointPath(endpointPath).split('/').filter(Boolean);
  const pattern = segments
    .map((segment) => (segment.startsWith(':') || segment.startsWith('*') ? '[^/]+' : escapeRegExp(segment)))
    .join('/');
  return new RegExp(`^/${pattern}$`);
}

export function extractDocumentedEndpoints(markdown, source = 'inline') {
  const endpoints = [];
  const rowPattern = /\|\s*(GET|POST|PUT|DELETE|PATCH)\s*\|\s*`([^`]+)`\s*\|\s*([^|]*)\|\s*([^|]*)\|/g;
  let match;
  while ((match = rowPattern.exec(markdown))) {
    endpoints.push({
      method: match[1],
      path: normalizeEndpointPath(match[2]),
      auth: match[3].trim(),
      description: match[4].trim(),
      source
    });
  }
  return endpoints;
}

export function extractDocumentedEndpointsFromDir(docsDir = DEFAULT_DOCS_DIR) {
  const endpoints = [];
  for (const fileName of fs.readdirSync(docsDir).filter((file) => file.endsWith('.md')).sort()) {
    const filePath = path.join(docsDir, fileName);
    const markdown = fs.readFileSync(filePath, 'utf8');
    endpoints.push(...extractDocumentedEndpoints(markdown, fileName));
  }
  return endpoints;
}

export function documentCoversCall(documentedEndpoints, call) {
  const callPath = normalizeEndpointPath(call.path);
  return documentedEndpoints.some((endpoint) => {
    return endpoint.method === call.method && endpointPattern(endpoint.path).test(callPath);
  });
}

export function extractTangSengWebCallsFromText(sourceText, source = 'inline') {
  const calls = [];
  const callPattern = /\b(?:WKApp\.apiClient|APIClient\.shared|axios)\s*\.\s*(get|post|put|delete)\s*\(\s*([`'"])([\s\S]*?)\2/g;
  let match;
  while ((match = callPattern.exec(sourceText))) {
    const method = match[1].toUpperCase();
    if (!METHODS.has(method)) continue;
    calls.push({
      method,
      path: normalizeEndpointPath(normalizeSourcePath(match[3])),
      source
    });
  }
  return calls;
}

function walkFiles(rootDir, files = []) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) walkFiles(fullPath, files);
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

export function extractTangSengWebCallsFromDir(tangSengWebDir) {
  const roots = [
    path.join(tangSengWebDir, 'packages'),
    path.join(tangSengWebDir, 'apps/web/src')
  ].filter((root) => fs.existsSync(root));
  const unique = new Map();

  for (const filePath of roots.flatMap((root) => walkFiles(root))) {
    const relativePath = path.relative(tangSengWebDir, filePath);
    if (relativePath.endsWith('Service/APIClient.ts')) continue;
    const calls = extractTangSengWebCallsFromText(fs.readFileSync(filePath, 'utf8'), relativePath);
    for (const call of calls) {
      const key = `${call.method} ${call.path}`;
      if (!unique.has(key)) unique.set(key, { ...call, sources: [] });
      unique.get(key).sources.push(relativePath);
    }
  }

  return [...unique.values()].sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

export function diffCoverage(documentedEndpoints, sourceCalls) {
  return sourceCalls.filter((call) => !documentCoversCall(documentedEndpoints, call));
}

export function buildProbePlan({
  username = '13733632709',
  password = '123456',
  deviceId = `api-doc-test-${Date.now()}`,
  appVersion = '1.0.0'
} = {}) {
  const device = {
    device_id: deviceId,
    device_name: 'agenthub-api-network-runner',
    device_model: 'node-fetch'
  };

  return [
    {
      name: 'health',
      method: 'GET',
      path: '/v1/health',
      safe: true,
      requiresAuth: false,
      expectedStatuses: [200],
      category: 'required'
    },
    {
      name: 'appconfig',
      method: 'GET',
      path: '/v1/common/appconfig',
      safe: true,
      requiresAuth: false,
      expectedStatuses: [200],
      category: 'required'
    },
    {
      name: 'login',
      method: 'POST',
      path: '/v1/user/login',
      safe: true,
      requiresAuth: false,
      expectedStatuses: [200],
      category: 'required',
      body: { username, password, flag: 1, device }
    },
    {
      name: 'appversion-web',
      method: 'GET',
      path: `/v1/common/appversion/web/${appVersion}`,
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200, 400, 404],
      category: 'diagnostic'
    },
    {
      name: 'devices',
      method: 'GET',
      path: '/v1/user/devices',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200],
      category: 'required'
    },
    {
      name: 'my-qrcode',
      method: 'GET',
      path: '/v1/user/qrcode',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200],
      category: 'required'
    },
    {
      name: 'friend-sync',
      method: 'GET',
      path: '/v1/friend/sync?version=0&api_version=1',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200],
      category: 'required'
    },
    {
      name: 'friend-apply-list',
      method: 'GET',
      path: '/v1/friend/apply',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200],
      category: 'required'
    },
    {
      name: 'group-my',
      method: 'GET',
      path: '/v1/group/my?limit=10',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200],
      category: 'required'
    },
    {
      name: 'conversation-sync',
      method: 'POST',
      path: '/v1/conversation/sync',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200],
      category: 'required',
      body: { msg_count: 1 }
    },
    {
      name: 'conversation-extra-sync',
      method: 'POST',
      path: '/v1/conversation/extra/sync',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200],
      category: 'required',
      body: { version: 0 }
    },
    {
      name: 'message-reminder-sync',
      method: 'POST',
      path: '/v1/message/reminder/sync',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200],
      category: 'required',
      body: { version: 0, limit: 10, channel_ids: [] }
    },
    {
      name: 'global-search',
      method: 'POST',
      path: '/v1/search/global',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200, 400],
      category: 'backend-dependent',
      body: { keyword: '系统', page: 1, limit: 10, content_type: [] }
    },
    {
      name: 'favorite-my',
      method: 'GET',
      path: '/v1/favorite/my?page_index=1&page_size=1',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200, 404, 501],
      category: 'frontend-dependency'
    },
    {
      name: 'sticker-category',
      method: 'GET',
      path: '/v1/sticker/user/category',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200, 404, 501],
      category: 'frontend-dependency'
    },
    {
      name: 'organization-joined',
      method: 'GET',
      path: '/v1/organization/joined',
      safe: true,
      requiresAuth: true,
      expectedStatuses: [200, 404, 501],
      category: 'frontend-dependency'
    }
  ];
}

function joinUrl(apiBaseUrl, endpointPath) {
  const base = apiBaseUrl.replace(/\/$/, '');
  const endpoint = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  if (base.endsWith('/v1') && endpoint.startsWith('/v1/')) {
    return `${base}${endpoint.slice(3)}`;
  }
  return `${base}${endpoint}`;
}

function redact(value) {
  if (typeof value === 'string') {
    return value.replace(/([A-Za-z0-9_-]{8})[A-Za-z0-9._-]{12,}/g, '$1***');
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (/token|password|authorization/i.test(key)) return [key, item ? '***' : item];
      return [key, redact(item)];
    }));
  }
  return value;
}

function responsePreview(data) {
  const redacted = redact(data);
  const text = typeof redacted === 'string' ? redacted : JSON.stringify(redacted);
  return text.length > 700 ? `${text.slice(0, 700)}...` : text;
}

async function readJsonOrText(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractToken(loginData) {
  const candidates = [
    loginData?.token,
    loginData?.data?.token,
    loginData?.result?.token,
    loginData?.user?.token
  ];
  return candidates.find((token) => typeof token === 'string' && token.length > 0);
}

function loginBodies(probe) {
  const bodies = [probe.body];
  const username = probe.body?.username;
  if (/^1\d{10}$/.test(username)) {
    bodies.push({ ...probe.body, username: `0086${username}` });
    bodies.push({ ...probe.body, username: `86${username}` });
  }
  return bodies;
}

async function requestProbe({ apiBaseUrl, probe, token }) {
  const headers = {};
  if (probe.body !== undefined) headers['content-type'] = 'application/json';
  if (probe.requiresAuth && token) {
    headers.token = token;
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(joinUrl(apiBaseUrl, probe.path), {
    method: probe.method,
    headers,
    body: probe.body !== undefined ? JSON.stringify(probe.body) : undefined
  });
  const data = await readJsonOrText(response);
  return {
    name: probe.name,
    method: probe.method,
    path: probe.path,
    category: probe.category,
    safe: probe.safe,
    status: response.status,
    ok: probe.expectedStatuses.includes(response.status),
    expectedStatuses: probe.expectedStatuses,
    responsePreview: responsePreview(data),
    data
  };
}

export async function runNetworkProbes(options = {}) {
  const {
    apiBaseUrl = 'http://172.18.58.156:3000/v1',
    username = process.env.IM_API_USERNAME || '13733632709',
    password = process.env.IM_API_PASSWORD || '123456',
    deviceId = process.env.IM_API_DEVICE_ID || `api-doc-test-${Date.now()}`,
    appVersion = process.env.IM_API_APP_VERSION || '1.0.0'
  } = options;
  const probes = buildProbePlan({ username, password, deviceId, appVersion });
  const results = [];
  let token = '';

  for (const probe of probes) {
    if (probe.name !== 'login') {
      const result = await requestProbe({ apiBaseUrl, probe, token });
      results.push(result);
      continue;
    }

    let lastResult;
    for (const body of loginBodies(probe)) {
      lastResult = await requestProbe({ apiBaseUrl, probe: { ...probe, body }, token });
      token = extractToken(lastResult.data) || '';
      if (lastResult.ok && token) {
        lastResult.loginVariant = body.username === username ? 'raw' : body.username;
        break;
      }
    }
    if (!token && lastResult) lastResult.ok = false;
    results.push(lastResult);
  }

  return {
    apiBaseUrl,
    generatedAt: new Date().toISOString(),
    tokenAcquired: Boolean(token),
    results: results.map(({ data, ...result }) => result),
    summary: summarizeResults(results)
  };
}

function summarizeResults(results) {
  const failed = results.filter((result) => !result.ok);
  const frontendDependencyWarnings = results.filter((result) => {
    return result.category === 'frontend-dependency' && [404, 501].includes(result.status);
  });
  const backendDependencyWarnings = results.filter((result) => {
    return result.category === 'backend-dependent' && result.status !== 200;
  });
  const requiredFailures = failed.filter((result) => {
    return !(result.category === 'frontend-dependency' && [404, 501].includes(result.status));
  });
  return {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    requiredFailures: requiredFailures.length,
    frontendDependencyWarnings: frontendDependencyWarnings.length,
    backendDependencyWarnings: backendDependencyWarnings.length
  };
}

function markdownReport(report) {
  const lines = [
    '# IM API Network Probe Report',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- apiBaseUrl: ${report.apiBaseUrl}`,
    `- tokenAcquired: ${report.tokenAcquired}`,
    `- total: ${report.summary.total}`,
    `- requiredFailures: ${report.summary.requiredFailures}`,
    `- frontendDependencyWarnings: ${report.summary.frontendDependencyWarnings}`,
    `- backendDependencyWarnings: ${report.summary.backendDependencyWarnings}`,
    '',
    '| Probe | Method | Path | Status | Category | Result |',
    '|---|---|---|---:|---|---|'
  ];

  for (const result of report.results) {
    const state = result.ok ? 'pass' : 'fail';
    lines.push(`| ${result.name} | ${result.method} | \`${result.path}\` | ${result.status} | ${result.category} | ${state} |`);
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      args._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function writeReport(report, outRoot = DEFAULT_OUT_ROOT) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const outDir = path.join(outRoot, `api-network-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), markdownReport(report));
  return outDir;
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'help';

  if (command === 'coverage') {
    const docsDir = path.resolve(args.docs || DEFAULT_DOCS_DIR);
    const sourceDir = path.resolve(args.source || process.env.TSDD_WEB_DIR || '/tmp/TangSengDaoDaoWeb-codex-api-audit');
    const documented = extractDocumentedEndpointsFromDir(docsDir);
    const calls = extractTangSengWebCallsFromDir(sourceDir);
    const missing = diffCoverage(documented, calls);
    const result = { docs: documented.length, source: calls.length, missing };
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = missing.length === 0 ? 0 : 1;
    return;
  }

  if (command === 'network') {
    const report = await runNetworkProbes({
      apiBaseUrl: args['api-base'] || process.env.IM_API_BASE_URL || 'http://172.18.58.156:3000/v1',
      username: args.username || process.env.IM_API_USERNAME || '13733632709',
      password: args.password || process.env.IM_API_PASSWORD || '123456',
      deviceId: args['device-id'] || process.env.IM_API_DEVICE_ID || `api-doc-test-${Date.now()}`,
      appVersion: args['app-version'] || process.env.IM_API_APP_VERSION || '1.0.0'
    });
    const outDir = writeReport(report, path.resolve(args.out || DEFAULT_OUT_ROOT));
    console.log(JSON.stringify({ outDir, summary: report.summary }, null, 2));
    process.exitCode = report.summary.requiredFailures === 0 ? 0 : 1;
    return;
  }

  console.log(`Usage:
  node sections/agenthub_ui/.ai/tests/im-api-network-runner.mjs coverage --source /tmp/TangSengDaoDaoWeb-codex-api-audit
  IM_API_PASSWORD=*** node sections/agenthub_ui/.ai/tests/im-api-network-runner.mjs network --api-base http://172.18.58.156:3000/v1
`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
