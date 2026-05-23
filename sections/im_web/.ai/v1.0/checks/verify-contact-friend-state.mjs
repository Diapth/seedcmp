import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const sourcePath = path.join(repoRoot, 'packages/contacts-vue/src/utils/friendSearchState.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    strict: true
  }
}).outputText;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'friend-state-'));
const modulePath = path.join(tempDir, 'friendSearchState.mjs');
fs.writeFileSync(modulePath, compiled, 'utf8');

const { getFriendSearchState } = await import(pathToFileURL(modulePath));

assert.equal(
  getFriendSearchState({ uid: 'me' }, { currentUid: 'me', contacts: [] }).type,
  'self'
);
assert.equal(
  getFriendSearchState({ uid: 'friend-a', follow: 0 }, {
    currentUid: 'me',
    contacts: [{ uid: 'friend-a', name: 'Friend A' }]
  }).type,
  'friend'
);
assert.equal(
  getFriendSearchState({ uid: 'friend-b', follow: 1 }, {
    currentUid: 'me',
    contacts: []
  }).type,
  'friend'
);
assert.equal(
  getFriendSearchState({ uid: 'stranger', follow: 0 }, {
    currentUid: 'me',
    contacts: [{ uid: 'friend-a', name: 'Friend A' }]
  }).type,
  'can_apply'
);

console.log('contact friend state checks passed');
