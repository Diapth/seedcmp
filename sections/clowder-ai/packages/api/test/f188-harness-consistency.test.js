/**
 * F188 memory routing reference consistency.
 *
 * The AgentHub target skill profile keeps memory routing as a reference doc,
 * not as a standalone memory-navigation skill.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = (() => {
  // Walk up until we find the Cat Cafe skill source.
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== '/' && !existsSync(join(dir, 'cat-cafe-skills/manifest.yaml'))) {
    dir = dirname(dir);
  }
  return dir;
})();

const PARTIAL_PATH = 'cat-cafe-skills/refs/memory-routing-partial.md';
const REMOVED_MEMORY_SKILLS = ['memory-navigation', 'memory-search-best-practices'];

describe('F188 memory routing reference after target skill slimming', () => {
  test('partial reference still documents all three memory entry tools', () => {
    const full = join(ROOT, PARTIAL_PATH);
    assert.ok(existsSync(full), `partial missing: ${PARTIAL_PATH}`);
    const content = readFileSync(full, 'utf-8');
    assert.ok(content.includes('三入口'));
    assert.ok(content.includes('cat_cafe_graph_resolve'));
    assert.ok(content.includes('cat_cafe_list_recent'));
    assert.ok(content.includes('cat_cafe_search_evidence'));
  });

  test('memory routing is no longer registered as standalone skills', () => {
    const manifest = readFileSync(join(ROOT, 'cat-cafe-skills/manifest.yaml'), 'utf-8');
    for (const skillName of REMOVED_MEMORY_SKILLS) {
      assert.ok(!manifest.includes(`${skillName}:`), `${skillName} should not be registered in target profile`);
      assert.equal(
        existsSync(join(ROOT, `cat-cafe-skills/${skillName}/SKILL.md`)),
        false,
        `${skillName} source directory should be removed`,
      );
    }
  });
});
