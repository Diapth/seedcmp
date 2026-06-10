import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const TEMPLATE_PATH = join(ROOT, 'cat-template.json');
const AVATAR_DIR = join(ROOT, 'assets/avatars');

const EXPECTED_AVATAR_BASENAMES = new Map([
  ['architect', 'ragdoll'],
  ['peer-reviewer', 'maine-coon'],
  ['coordinator', 'siamese'],
  ['devops', 'bengal'],
  ['frontend', 'persian'],
  ['qa', 'british-shorthair'],
  ['source-curator', 'li-hua'],
  ['deck-strategist', 'russian-blue'],
  ['storyboard-designer', 'turkish-angora'],
  ['svg-executor-guardian', 'norwegian-forest'],
  ['deck-qa-exporter', 'silver-shaded'],
]);

function loadTemplates() {
  const raw = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf-8'));
  return raw.roleTemplates ?? [];
}

describe('cat-template role avatars', () => {
  const templates = loadTemplates();

  it('keeps every role template avatar on the cat-breed filename', () => {
    const byId = new Map(templates.map((template) => [template.id, template]));

    for (const [id, avatarBasename] of EXPECTED_AVATAR_BASENAMES) {
      const template = byId.get(id);
      assert.ok(template, `missing role template: ${id}`);

      const expectedAvatar = `/assets/avatars/${avatarBasename}.png`;
      assert.equal(template.avatar, expectedAvatar, `${template.name} should use ${expectedAvatar}`);
      assert.ok(existsSync(join(AVATAR_DIR, `${avatarBasename}.png`)), `${expectedAvatar} file is missing`);
    }
  });

  it('does not leave stale role-id avatar filenames in the avatar directory', () => {
    const staleFiles = templates
      .map((template) => `${template.id}.png`)
      .filter((fileName) => existsSync(join(AVATAR_DIR, fileName)));

    assert.deepEqual(staleFiles, []);
  });

  it('has exactly one png asset for each role template cat avatar', () => {
    const expectedFiles = [...EXPECTED_AVATAR_BASENAMES.values()]
      .map((avatarBasename) => `${avatarBasename}.png`)
      .sort();
    const actualFiles = readdirSync(AVATAR_DIR)
      .filter((fileName) => fileName.endsWith('.png'))
      .map((fileName) => basename(fileName))
      .sort();

    assert.deepEqual(actualFiles, expectedFiles);
  });
});
