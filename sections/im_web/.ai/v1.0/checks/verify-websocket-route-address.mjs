import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { imWebRoot } from './paths.mjs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = imWebRoot;
const sourcePath = path.join(repoRoot, 'packages/datasource-vue/src/stores/sdkAddress.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    strict: true
  }
}).outputText;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-address-'));
const modulePath = path.join(tempDir, 'sdkAddress.mjs');
fs.writeFileSync(modulePath, compiled, 'utf8');

const { resolveWebsocketConnectAddr } = await import(pathToFileURL(modulePath));

assert.equal(
  resolveWebsocketConnectAddr('ws://0.0.0.0:5200', '100.79.157.76'),
  'ws://100.79.157.76:5200/'
);
assert.equal(
  resolveWebsocketConnectAddr('ws://127.0.0.1:5200/', '100.79.157.76'),
  'ws://100.79.157.76:5200/'
);
assert.equal(
  resolveWebsocketConnectAddr('ws://im.example.com:5200', '100.79.157.76'),
  'ws://im.example.com:5200/'
);
assert.equal(
  resolveWebsocketConnectAddr('', '100.79.157.76'),
  'ws://100.79.157.76:5200'
);

console.log('websocket route address checks passed');
