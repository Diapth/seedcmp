import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { imWebRoot } from './paths.mjs';

const repoRoot = imWebRoot;

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const cmdListeners = read('packages/datasource-vue/src/cmd/index.ts');

assert.match(
  cmdListeners,
  /import\s+\{\s*useGroupStore\s*\}\s+from\s+['"]\.\.\/stores\/groupStore['"]/,
  'CMD listeners should import groupStore'
);

assert.match(
  cmdListeners,
  /const\s+groupStore\s*=\s*useGroupStore\(\)/,
  'CMD listeners should instantiate groupStore inside the listener'
);

const avatarUpdateBody = cmdListeners.match(/case 'groupAvatarUpdate':[\s\S]*?break;/)?.[0] || '';
assert.match(
  avatarUpdateBody,
  /delete\s+groupStore\.groups\s*\[\s*channel\.channelID\s*\]/,
  'groupAvatarUpdate should invalidate the cached groupStore group before re-fetching group info'
);
assert.match(
  avatarUpdateBody,
  /groupStore\.getGroupInfo\(channel\.channelID\)/,
  'groupAvatarUpdate should re-fetch group info into groupStore'
);

const memberUpdateBody = cmdListeners.match(/case 'memberUpdate':[\s\S]*?break;/)?.[0] || '';
assert.match(
  memberUpdateBody,
  /channelStore\.fetchGroupMembers\(channel\.channelID\)/,
  'memberUpdate should keep refreshing channelStore members for legacy consumers'
);
assert.match(
  memberUpdateBody,
  /groupStore\.fetchGroupMembers\(channel\.channelID\)/,
  'memberUpdate should refresh normalized groupStore members for group UI consumers'
);

console.log('issue 12 CMD groupStore synchronization checks passed');
