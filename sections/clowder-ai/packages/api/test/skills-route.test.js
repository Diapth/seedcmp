/**
 * Skills route tests
 * GET /api/skills — Clowder AI 共享 Skills 看板数据
 */

import assert from 'node:assert/strict';
import { mkdir, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import Fastify from 'fastify';
import { writeCapabilitiesConfig } from '../dist/config/capabilities/capability-orchestrator.js';
import { skillsRoutes } from '../dist/routes/skills.js';

const AUTH_HEADERS = { 'x-cat-cafe-user': 'test-user' };

describe('Skills Route', () => {
  it('returns 401 when no identity header is provided', async () => {
    const app = Fastify();
    await app.register(skillsRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('Identity required'));

    await app.close();
  });

  it('GET /api/skills returns skills array and summary', async () => {
    const app = Fastify();
    await app.register(skillsRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
      headers: AUTH_HEADERS,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);

    // Response structure
    assert.ok(Array.isArray(body.skills), 'skills should be an array');
    assert.ok(body.summary, 'should have summary');
    assert.equal(typeof body.summary.total, 'number');
    assert.equal(typeof body.summary.allMounted, 'boolean');
    assert.equal(typeof body.summary.registrationConsistent, 'boolean');

    await app.close();
  });

  it('each skill entry has required fields', async () => {
    const app = Fastify();
    await app.register(skillsRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
      headers: AUTH_HEADERS,
    });

    const body = JSON.parse(res.body);
    if (body.skills.length === 0) {
      // No skills found (possible in CI), skip field checks
      await app.close();
      return;
    }

    for (const skill of body.skills) {
      assert.equal(typeof skill.name, 'string', 'name should be string');
      assert.equal(typeof skill.category, 'string', 'category should be string');
      assert.equal(typeof skill.trigger, 'string', 'trigger should be string');
      assert.ok(skill.mounts, 'should have mounts');
      assert.equal(typeof skill.mounts.claude, 'boolean');
      assert.equal(typeof skill.mounts.codex, 'boolean');
      assert.equal(typeof skill.mounts.gemini, 'boolean');
      assert.equal(typeof skill.mounts.kimi, 'boolean');
    }

    await app.close();
  });

  it('skills follow BOOTSTRAP ordering (registered before unregistered)', async () => {
    const app = Fastify();
    await app.register(skillsRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
      headers: AUTH_HEADERS,
    });

    const body = JSON.parse(res.body);
    if (body.skills.length === 0) {
      await app.close();
      return;
    }

    // Skills with a category (from BOOTSTRAP) should come before '未分类'
    let seenUnregistered = false;
    for (const skill of body.skills) {
      if (skill.category === '未分类') {
        seenUnregistered = true;
      } else if (seenUnregistered) {
        assert.fail(`Registered skill "${skill.name}" appeared after unregistered skill — ordering violated`);
      }
    }

    await app.close();
  });

  it('summary.total matches skills array length', async () => {
    const app = Fastify();
    await app.register(skillsRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
      headers: AUTH_HEADERS,
    });

    const body = JSON.parse(res.body);
    assert.equal(body.summary.total, body.skills.length);

    await app.close();
  });

  it('treats directory-level project skills symlinks as mounted for all providers', async () => {
    const projectDir = join('/tmp', `skills-route-test-dir-symlink-${Date.now()}`);
    const homeDir = join('/tmp', `skills-route-test-home-${Date.now()}`);
    const sourceSkillsDir = join(process.cwd(), '..', '..', 'cat-cafe-skills');
    const prevHome = process.env.HOME;

    await Promise.all([
      mkdir(join(projectDir, '.claude'), { recursive: true }),
      mkdir(join(projectDir, '.codex'), { recursive: true }),
      mkdir(join(projectDir, '.gemini'), { recursive: true }),
      mkdir(join(projectDir, '.kimi'), { recursive: true }),
      mkdir(homeDir, { recursive: true }),
    ]);
    await Promise.all([
      symlink(sourceSkillsDir, join(projectDir, '.claude', 'skills')),
      symlink(sourceSkillsDir, join(projectDir, '.codex', 'skills')),
      symlink(sourceSkillsDir, join(projectDir, '.gemini', 'skills')),
      symlink(sourceSkillsDir, join(projectDir, '.kimi', 'skills')),
    ]);

    process.env.HOME = homeDir;

    const app = Fastify();
    await app.register(skillsRoutes);
    await app.ready();

    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/skills?projectPath=${encodeURIComponent(projectDir)}`,
        headers: AUTH_HEADERS,
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.summary.allMounted, true, 'project-level directory symlinks should count as mounted');

      const debugging = body.skills.find((skill) => skill.name === 'debugging');
      assert.ok(debugging, 'debugging skill should be present');
      assert.deepEqual(debugging.mounts, { claude: true, codex: true, gemini: true, kimi: true });
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      await app.close();
      await rm(projectDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it('accepts HOME-level fallback symlinks that still point to the main repo skills tree', async () => {
    const projectDir = join('/tmp', `skills-route-test-fallback-project-${Date.now()}`);
    const homeDir = join('/tmp', `skills-route-test-fallback-home-${Date.now()}`);
    const prevHome = process.env.HOME;
    const mainSkillsDir = resolve(process.cwd(), '..', '..', 'cat-cafe-skills');

    await Promise.all([
      mkdir(projectDir, { recursive: true }),
      mkdir(join(homeDir, '.claude'), { recursive: true }),
      mkdir(join(homeDir, '.codex'), { recursive: true }),
      mkdir(join(homeDir, '.gemini'), { recursive: true }),
      mkdir(join(homeDir, '.kimi'), { recursive: true }),
    ]);
    await Promise.all([
      symlink(mainSkillsDir, join(homeDir, '.claude', 'skills')),
      symlink(mainSkillsDir, join(homeDir, '.codex', 'skills')),
      symlink(mainSkillsDir, join(homeDir, '.gemini', 'skills')),
      symlink(mainSkillsDir, join(homeDir, '.kimi', 'skills')),
    ]);

    process.env.HOME = homeDir;

    const app = Fastify();
    await app.register(skillsRoutes);
    await app.ready();

    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/skills?projectPath=${encodeURIComponent(projectDir)}`,
        headers: AUTH_HEADERS,
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.summary.allMounted, true, 'main-repo fallback skills symlink should still count as mounted');
      const debugging = body.skills.find((skill) => skill.name === 'debugging');
      assert.ok(debugging, 'debugging skill should be present');
      assert.deepEqual(debugging.mounts, { claude: true, codex: true, gemini: true, kimi: true });
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      await app.close();
      await rm(projectDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it('uses the simplified target skill profile and omits removed skills', async () => {
    const projectDir = join('/tmp', `skills-route-test-project-mcp-${Date.now()}`);
    await mkdir(projectDir, { recursive: true });
    await writeCapabilitiesConfig(projectDir, {
      version: 1,
      capabilities: [
        {
          id: 'pencil',
          type: 'mcp',
          enabled: false,
          source: 'external',
          mcpServer: { resolver: 'pencil', command: '', args: [] },
        },
      ],
    });

    const app = Fastify();
    await app.register(skillsRoutes);
    await app.ready();

    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/skills?projectPath=${encodeURIComponent(projectDir)}`,
        headers: AUTH_HEADERS,
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      const names = body.skills.map((skill) => skill.name);

      assert.ok(names.includes('design-assets'), 'design-assets should replace image/pencil/rich-messaging skills');
      assert.ok(names.includes('review-and-release'), 'review-and-release should replace review/merge split skills');
      assert.ok(names.includes('multi-agent-collaboration'), 'multi-agent-collaboration should replace cross-thread skills');
      assert.ok(!names.includes('pencil-design'), 'pencil-design should be removed from target profile');
      assert.ok(!names.includes('browser-automation'), 'browser-automation should be removed from target profile');
      assert.ok(!names.includes('receive-review'), 'receive-review should be merged into review-and-release');
      assert.ok(!names.includes('merge-gate'), 'merge-gate should be merged into review-and-release');

      const designAssets = body.skills.find((skill) => skill.name === 'design-assets');
      assert.ok(designAssets, 'design-assets should be present');
      assert.equal(
        designAssets.requiresMcp,
        undefined,
        'capability config alone should not create requiresMcp badges without manifest requires_mcp',
      );
    } finally {
      await app.close();
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it('exposes the 13-skill target profile without MCP dependency badges', async () => {
    const app = Fastify();
    await app.register(skillsRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
      headers: AUTH_HEADERS,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    const names = body.skills.map((skill) => skill.name);

    assert.equal(body.summary.total, 13);
    assert.deepEqual(names, [
      'feat-lifecycle',
      'collaborative-thinking',
      'writing-plans',
      'tdd',
      'debugging',
      'quality-gate',
      'review-and-release',
      'multi-agent-collaboration',
      'deep-research',
      'browser-preview',
      'design-assets',
      'video-forge',
      'writing-skills',
    ]);

    for (const skill of body.skills) {
      assert.equal(skill.requiresMcp, undefined, `${skill.name} should not declare MCP dependencies`);
    }

    await app.close();
  });
});
