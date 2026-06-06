/**
 * Auto-populate catRegistry for tests.
 *
 * Seeds an isolated temp project with the repo template plus a dedicated
 * runtime catalog fixture, so the registry is deterministic regardless of
 * stale .cat-cafe/cat-catalog.json files other tests may create.
 *
 * Also redirects CAT_TEMPLATE_PATH to an isolated temp copy so that
 * getCachedConfig() → loadCatConfig() (used by getRoster(), getReviewPolicy(),
 * etc.) never picks up catalog artifacts from other test files.
 *
 * Usage: import './helpers/setup-cat-registry.js';
 *
 * See also: packages/api/package.json `--import $(pwd)/...` for Node loader usage.
 */

import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catRegistry } from '@cat-cafe/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(__dirname, '../../../../cat-template.json');
const RUNTIME_CATALOG_FIXTURE_PATH = resolve(__dirname, '../fixtures/runtime-cat-catalog.json');

// Redirect CAT_TEMPLATE_PATH to a temp directory with an isolated runtime
// catalog. This keeps default loadCatConfig() deterministic for tests while
// preserving the real runtime resolution path (template + sibling catalog).
const tmpDir = resolve(process.env.TMPDIR ?? '/tmp', `cat-cafe-test-template-${process.pid}`);
mkdirSync(tmpDir, { recursive: true });
cpSync(TEMPLATE_PATH, resolve(tmpDir, 'cat-template.json'));
mkdirSync(resolve(tmpDir, '.cat-cafe'), { recursive: true });
cpSync(RUNTIME_CATALOG_FIXTURE_PATH, resolve(tmpDir, '.cat-cafe', 'cat-catalog.json'));
process.env.CAT_TEMPLATE_PATH = resolve(tmpDir, 'cat-template.json');

async function registerAllCats() {
  const { loadCatConfig, toAllCatConfigs } = await import('../../dist/config/cat-config-loader.js');
  const allConfigs = toAllCatConfigs(loadCatConfig());
  for (const [id, config] of Object.entries(allConfigs)) {
    if (!catRegistry.has(id)) {
      catRegistry.register(id, config);
    }
  }
}

await registerAllCats();
