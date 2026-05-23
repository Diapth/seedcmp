import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync, rmSync } from 'node:fs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const checksDir = join(repoRoot, '.ai', 'checks');
const imWebDir = repoRoot;

const tests = [
  {
    name: '[ISSUE-09] Contact and Friend State Checks',
    command: 'node verify-contact-friend-state.mjs',
    cwd: checksDir
  },
  {
    name: '[ISSUE-10] Group Chat Retention State Checks',
    command: 'node verify-group-chat-retention-state.mjs',
    cwd: checksDir
  },
  {
    name: '[ISSUE-10/11] Group Chat and Conversation Summary Checks',
    command: 'node verify-group-chat-and-summary.mjs',
    cwd: checksDir
  },
  {
    name: '[ISSUE-11] groupChatUtils Unit Tests (TypeScript compilation & execution)',
    command: 'npx tsc packages/datasource-vue/tests/groupChatUtils.test.ts --module NodeNext --moduleResolution NodeNext --target ES2022 --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --outDir ./scratch/seedcmp-im-tests && node ./scratch/seedcmp-im-tests/tests/groupChatUtils.test.js',
    cwd: imWebDir,
    cleanup: () => {
      const outDir = join(imWebDir, 'scratch', 'seedcmp-im-tests');
      if (existsSync(outDir)) {
        try {
          rmSync(outDir, { recursive: true, force: true });
        } catch (e) {
          // ignore cleanup errors
        }
      }
    }
  },
  {
    name: '[ISSUE-12] CMD Group Store Synchronization Checks',
    command: 'node verify-issue-12-cmd-group-store-sync.mjs',
    cwd: checksDir
  }
];

console.log('===========================================================');
console.log('🚀 Starting Automation Regression Tests for Issues 9-12...');
console.log('===========================================================');

let passedCount = 0;
let failedCount = 0;

for (const t of tests) {
  console.log(`\n👉 Running: ${t.name}...`);
  try {
    const stdout = execSync(t.command, { cwd: t.cwd, encoding: 'utf8', stdio: 'pipe' });
    console.log('✅ Passed!');
    if (stdout.trim()) {
      console.log(`   Output: ${stdout.trim().split('\n').map(l => '     ' + l).join('\n').trim()}`);
    }
    passedCount++;
  } catch (err) {
    console.error(`❌ Failed: ${t.name}`);
    console.error(`   Error details:\n${err.message || err}`);
    if (err.stdout) console.error(`   Stdout:\n${err.stdout}`);
    if (err.stderr) console.error(`   Stderr:\n${err.stderr}`);
    failedCount++;
  } finally {
    if (t.cleanup) {
      t.cleanup();
    }
  }
}

console.log('\n===========================================================');
console.log('📊 Test Execution Summary:');
console.log(`   Total Tests: ${tests.length}`);
console.log(`   Passed:      ${passedCount}`);
console.log(`   Failed:      ${failedCount}`);
console.log('===========================================================');

if (failedCount > 0) {
  console.error('\n⚠️ Some regression tests failed! Please investigate the errors above.');
  process.exit(1);
} else {
  console.log('\n✨ All Issue 9-12 automation checks passed successfully! No regressions detected.');
  process.exit(0);
}
